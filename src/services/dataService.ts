import { supabase } from '@/integrations/supabase/client';
import { Song, QueueItem, RankingItem, AppSettings } from '@/types/song';

// Caminho do arquivo TSV público
const SONGS_TSV_URL = '/lista_de_musicas.tsv';

// Versão do cache (alterar ao mudar formato/decodificação)
const SONGS_CACHE_VERSION = 'v2';
const SONGS_CACHE_KEY = `cachedSongs:${SONGS_CACHE_VERSION}`;
const SONGS_CACHE_TS_KEY = `songsCacheTimestamp:${SONGS_CACHE_VERSION}`;

// Chave para armazenar a fila local (escopo por aba)
const QUEUE_STORAGE_KEY = 'queue:v1';

// Chave para armazenar o ranking local (escopo por aba)
const RANKING_STORAGE_KEY = 'ranking:v1';

// Normaliza texto para busca (minúsculas, sem acento)
const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Helper function to extract filename from path
const getFilenameFromPath = (filepath: string): string => {
  // Remove any quotes from the entire path
  const cleanPath = filepath.replace(/["']/g, '');
  // Handle both forward and backward slashes
  const normalizedPath = cleanPath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || cleanPath;
};

// Converte o conteúdo TSV em uma lista de músicas
const parseSongsFromTsv = (tsv: string): Song[] => {
  const lines = tsv.split(/\r?\n/);
  const result: Song[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line || !line.trim()) continue;

    // Pular cabeçalho se existir
    if (index === 0 && /^number\ttitle\tartist\tlyrics/i.test(line)) {
      continue;
    }

    const parts = line.split('\t');
    if (parts.length < 3) continue; // requer pelo menos number, title, artist

    const number = (parts[0] || '').trim();
    const title = (parts[1] || '').trim();
    const artist = (parts[2] || '').trim();
    const lyrics = (parts[3] || '').trim();

    if (!number || !title) continue;

    result.push({
      id: number, // usa o próprio número como id estável
      number,
      title,
      artist,
      lyrics: lyrics || null,
    });
  }

  return result;
};

// Decodifica texto com fallback para windows-1252 quando houver substituições (�)
const decodeWithFallback = (buffer: ArrayBuffer): string => {
  // Tenta UTF-8 primeiro
  let text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
  // Se houver muitos caracteres de substituição, tenta windows-1252
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount > 0) {
    try {
      text = new TextDecoder('windows-1252', { fatal: false }).decode(new Uint8Array(buffer));
    } catch (_) {
      // mantém UTF-8 se windows-1252 não estiver disponível
    }
  }
  return text;
};

// Carrega músicas a partir do TSV público
const loadSongsFromTsv = async (): Promise<Song[]> => {
  const response = await fetch(SONGS_TSV_URL, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Falha ao carregar TSV: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const text = decodeWithFallback(buffer);
  return parseSongsFromTsv(text);
};

// Utilidades de fila local
const loadQueueFromStorage = (): QueueItem[] => {
  try {
    const raw = sessionStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveQueueToStorage = (queue: QueueItem[]): void => {
  sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
};

const generateQueueItemId = (): string => {
  try {
    // @ts-ignore - crypto pode não estar tipado em alguns ambientes
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      // @ts-ignore
      return crypto.randomUUID();
    }
  } catch {}
  return 'q_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

const normalizeQueuePositions = (queue: QueueItem[]): QueueItem[] => {
  return queue.map((item, index) => ({
    ...item,
    queue_position: index + 1,
    created_at: item.created_at || new Date().toISOString(),
    id: item.id || generateQueueItemId()
  }));
};

// Re-export the AppSettings type
export type { AppSettings };

// Função para buscar todas as músicas
export const getSongs = async (): Promise<Song[]> => {
  try {
    // Primeiro, tentar cache local (1h)
    const cachedSongs = localStorage.getItem(SONGS_CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(SONGS_CACHE_TS_KEY);
    const currentTime = Date.now();

    if (cachedSongs && cacheTimestamp && (currentTime - parseInt(cacheTimestamp)) < 3600000) {
      return JSON.parse(cachedSongs) as Song[];
    }

    // Carregar do TSV
    const songs = await loadSongsFromTsv();

    // Atualizar cache
    localStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(songs));
    localStorage.setItem(SONGS_CACHE_TS_KEY, String(currentTime));

    return songs;
  } catch (error) {
    console.error('Erro ao carregar músicas do TSV:', error);

    const cachedSongs = localStorage.getItem(SONGS_CACHE_KEY);
    if (cachedSongs) {
      return JSON.parse(cachedSongs) as Song[];
    }

    return [];
  }
};

// Busca músicas por termo diretamente no Supabase (título, artista ou número)
export const searchSongs = async (term: string, limit: number = 20): Promise<Song[]> => {
  try {
    const trimmed = term.trim();
    if (!trimmed) return [];

    const songs = await getSongs();
    const normalizedTerm = normalizeText(trimmed);

    const filtered = songs.filter((song) => {
      const inTitle = normalizeText(song.title).includes(normalizedTerm);
      const inArtist = normalizeText(song.artist).includes(normalizedTerm);
      const inNumber = song.number.includes(trimmed);
      return inTitle || inArtist || inNumber;
    });

    return filtered.slice(0, limit);
  } catch (error) {
    console.error('Erro ao buscar músicas localmente:', error);
    return [];
  }
};

// Função para adicionar uma música
export const addSong = async (song: Omit<Song, 'id'>): Promise<Song | null> => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .insert([song])
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar música:', error.message);
      return null;
    }

    // Limpar o cache para forçar a atualização na próxima busca
    localStorage.removeItem('cachedSongs');
    
    return data as Song;
  } catch (error) {
    console.error('Erro ao adicionar música:', error);
    return null;
  }
};

// Função para atualizar uma música
export const updateSong = async (song: Song): Promise<Song | null> => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .update(song)
      .eq('id', song.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar música:', error.message);
      return null;
    }

    // Limpar o cache para forçar a atualização na próxima busca
    localStorage.removeItem('cachedSongs');

    return data as Song;
  } catch (error) {
    console.error('Erro ao atualizar música:', error);
    return null;
  }
};

// Função para deletar uma música
export const deleteSong = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar música:', error.message);
      return false;
    }

    // Limpar o cache para forçar a atualização na próxima busca
    localStorage.removeItem('cachedSongs');

    return true;
  } catch (error) {
    console.error('Erro ao deletar música:', error);
    return false;
  }
};

// Função para buscar uma música pelo número
export const getSongByNumber = async (number: string): Promise<Song | null> => {
  try {
    const songs = await getSongs();
    // Buscar por correspondência exata do número ou id
    const found = songs.find((s) => s.number === number || s.id === number) || null;
    return found;
  } catch (error) {
    console.error('Erro ao buscar música por número (local TSV):', error);
    return null;
  }
};

// Resolve base URL do servidor local usando o host atual (suporta acesso na mesma rede)
const getServerBaseUrl = (): string => {
  try {
    const { protocol, hostname } = window.location;
    // Default porta 3001
    return `${protocol}//${hostname}:3001`;
  } catch {
    return `http://localhost:3001`;
  }
};

// Função para buscar a fila de reprodução (tenta servidor, fallback local por aba)
export const getQueue = async (): Promise<QueueItem[]> => {
  try {
    const base = getServerBaseUrl();
    const resp = await fetch(`${base}/queue`, { cache: 'no-cache' });
    if (resp.ok) {
      const data = await resp.json();
      return Array.isArray(data) ? (data as QueueItem[]) : [];
    }
  } catch (e) {
    // Ignora, usa fallback local
  }

  try {
    let queue = loadQueueFromStorage();
    if (!queue || queue.length === 0) return [];
    queue = normalizeQueuePositions(queue);
    saveQueueToStorage(queue);
    return queue;
  } catch (error) {
    console.error('Erro ao buscar fila local:', error);
    return [];
  }
};

// Função para adicionar uma música à fila (tenta servidor, fallback local)
export const addToQueue = async (queueItem: { song: Song; singer: string }): Promise<QueueItem | null> => {
  // Primeiro tenta no servidor compartilhado
  try {
    const base = getServerBaseUrl();
    const resp = await fetch(`${base}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queueItem)
    });
    if (resp.ok) {
      const data = await resp.json();
      return data as QueueItem;
    }
  } catch (e) {
    // Fallback para armazenamento local
  }

  try {
    const queue = loadQueueFromStorage();
    const nextPosition = queue.length > 0
      ? Math.max(...queue.map(q => q.queue_position || 0)) + 1
      : 1;

    const newItem: QueueItem = {
      id: generateQueueItemId(),
      song: queueItem.song,
      singer: queueItem.singer,
      queue_position: nextPosition,
      created_at: new Date().toISOString()
    };

    const updated = [...queue, newItem];
    saveQueueToStorage(updated);
    return newItem;
  } catch (error) {
    console.error('Erro ao adicionar à fila local:', error);
    return null;
  }
};

// Função para remover uma música da fila
export const removeFromQueue = async (index: number): Promise<boolean> => {
  try {
    const queue = loadQueueFromStorage();
    if (!queue || index < 0 || index >= queue.length) {
      console.error('Índice inválido para remover da fila.');
      return false;
    }
    queue.splice(index, 1);
    const normalized = normalizeQueuePositions(queue);
    saveQueueToStorage(normalized);
    return true;
  } catch (error) {
    console.error('Erro ao remover da fila local:', error);
    return false;
  }
};

// Função para limpar toda a fila
export const clearQueue = async (): Promise<boolean> => {
  try {
    sessionStorage.removeItem(QUEUE_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao limpar fila local:', error);
    return false;
  }
};

// Função para mover um item na fila
export const moveQueueItem = async (fromIndex: number, toIndex: number): Promise<boolean> => {
  try {
    const queue = loadQueueFromStorage();
    if (!queue || fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) {
      console.error('Índices inválidos para mover na fila.');
      return false;
    }

    const [moved] = queue.splice(fromIndex, 1);
    queue.splice(toIndex, 0, moved);

    const normalized = normalizeQueuePositions(queue);
    saveQueueToStorage(normalized);
    return true;
  } catch (error) {
    console.error('Erro ao mover item na fila local:', error);
    return false;
  }
};

// Função auxiliar para reordenar a fila
const reorderQueue = async (): Promise<void> => {
  try {
    const queue = loadQueueFromStorage();
    const normalized = normalizeQueuePositions(queue);
    saveQueueToStorage(normalized);
  } catch (error) {
    console.error('Erro ao reordenar fila local:', error);
  }
};

// Utilidades do ranking local
const loadRankingFromStorage = (): RankingItem[] => {
  try {
    const raw = sessionStorage.getItem(RANKING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RankingItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRankingToStorage = (ranking: RankingItem[]): void => {
  sessionStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(ranking));
};

// Função auxiliar para converter dados do ranking do banco para RankingItem
const convertToRankingItem = async (rankingRow: any): Promise<RankingItem> => {
  try {
    // Buscar dados da música relacionada
    const song = await getSongByNumber(rankingRow.song_id);
    if (!song) {
      console.warn(`Música com ID ${rankingRow.song_id} não encontrada no ranking, usando dados parciais`);
      // Retornar item do ranking mesmo sem a música completa
      return {
        id: rankingRow.id,
        song: {
          id: rankingRow.song_id,
          number: rankingRow.song_id,
          title: 'Música não encontrada',
          artist: '-',
          lyrics: null
        },
        singer: rankingRow.singer_name,
        score: rankingRow.score,
        date: rankingRow.created_at,
        created_at: rankingRow.created_at
      };
    }
    
    return {
      id: rankingRow.id,
      song: song,
      singer: rankingRow.singer_name,
      score: rankingRow.score,
      date: rankingRow.created_at,
      created_at: rankingRow.created_at
    };
  } catch (error) {
    console.error('Erro ao converter item do ranking:', error);
    throw error;
  }
};

// Função para buscar o ranking
export const getRanking = async (): Promise<RankingItem[]> => {
  try {
    const ranking = loadRankingFromStorage();
    // Ordenar por score desc e limitar a 10 (atualizado de 5 para 10)
    return [...ranking]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);
  } catch (error) {
    console.error('Erro ao buscar ranking local:', error);
    return [];
  }
};

// Função para adicionar uma pontuação ao ranking
export const addToRanking = async (rankingItem: { song: Song; singer: string; score: number }): Promise<RankingItem | null> => {
  try {
    const current = loadRankingFromStorage();
    const newItem: RankingItem = {
      id: (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)),
      song: rankingItem.song,
      singer: rankingItem.singer,
      score: rankingItem.score,
      date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    const updated = [...current, newItem];
    saveRankingToStorage(updated);
    return newItem;
  } catch (error) {
    console.error('Erro ao adicionar ao ranking local:', error);
    return null;
  }
};

// Função para limpar todo o ranking
export const clearRanking = async (): Promise<boolean> => {
  try {
    sessionStorage.removeItem(RANKING_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao limpar ranking local:', error);
    return false;
  }
};

// Função para remover um item específico do ranking
export const removeFromRanking = async (id: string): Promise<boolean> => {
  try {
    const ranking = loadRankingFromStorage();
    const filtered = ranking.filter(item => item.id !== id);
    saveRankingToStorage(filtered);
    return true;
  } catch (error) {
    console.error('Erro ao remover item do ranking:', error);
    return false;
  }
};

// Função para gerar uma pontuação aleatória
export const generateScore = (): number => {
  return Math.floor(Math.random() * (100 - 60 + 1)) + 60;
};

// Função para buscar as configurações do app
export const getSettings = async (): Promise<AppSettings | null> => {
  try {
    const SETTINGS_STORAGE_KEY = 'appSettings:v1';
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      return parsed;
    }
    // Default inicial
    const defaults: AppSettings = {
      videosPath: '',
      backgroundImage: undefined,
      soundEffects: {},
      adminPassword: 'admin123',
      useServer: true,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch (error) {
    console.error('Erro ao buscar configurações (local):', error);
    return {
      videosPath: '',
      backgroundImage: undefined,
      soundEffects: {},
      adminPassword: 'admin123',
      useServer: true,
      created_at: new Date().toISOString(),
    };
  }
};

// Função para atualizar as configurações do app
export const updateSettings = async (settings: AppSettings): Promise<AppSettings | null> => {
  try {
    const SETTINGS_STORAGE_KEY = 'appSettings:v1';
    const toSave: AppSettings = {
      ...settings,
      created_at: settings.created_at || new Date().toISOString(),
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
    // Sincronizar com o servidor local para que as rotas /videos e /sounds saibam os diretórios
    try {
      const getDirectoryFromPath = (filePath?: string) => {
        if (!filePath) return undefined;
        const clean = filePath.replace(/["']/g, '').replace(/\\/g, '/');
        const idx = clean.lastIndexOf('/');
        if (idx === -1) return undefined;
        return clean.substring(0, idx);
      };

      const soundsPathCandidates = [
        toSave.soundEffects?.high,
        toSave.soundEffects?.medium,
        toSave.soundEffects?.low,
        toSave.soundEffects?.drums,
        toSave.soundEffects?.incomplete,
      ];
      let soundsPath: string | undefined;
      for (const candidate of soundsPathCandidates) {
        const dir = getDirectoryFromPath(candidate);
        if (dir) { soundsPath = dir; break; }
      }

      await fetch('http://localhost:3001/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videosPath: toSave.videosPath,
          soundsPath,
        })
      }).catch(() => {});
    } catch (_) { /* ignora falhas de sync, configuração local já salva */ }

    return toSave;
  } catch (error) {
    console.error('Erro ao atualizar configurações (local):', error);
    return null;
  }
};

// Função para obter URL do vídeo baseada na configuração
export const getVideoUrl = async (songNumber: string): Promise<string> => {
  try {
    const settings = await getSettings();
    const videosPath = settings?.videosPath;
    const useServer = settings?.useServer !== false; // Default para true
    
    if (!videosPath) {
      throw new Error('Caminho dos vídeos não configurado');
    }

    if (useServer) {
      // Usar servidor local
      return `http://localhost:3001/videos/${songNumber}.mp4`;
    } else {
      // Acessar arquivo diretamente
      const videoPath = `${videosPath}/${songNumber}.mp4`;
      const videoUrl = `file:///${videoPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
      return videoUrl;
    }
  } catch (error) {
    console.error('Erro ao gerar URL do vídeo:', error);
    // Fallback para servidor local
    return `http://localhost:3001/videos/${songNumber}.mp4`;
  }
};

// Função para obter URL do som baseada na configuração
export const getSoundUrl = async (soundPath: string): Promise<string> => {
  try {
    if (!soundPath) {
      throw new Error('Caminho do som não fornecido');
    }

    const settings = await getSettings();
    const useServer = settings?.useServer !== false; // Default para true

    if (useServer) {
      // Usar servidor local
      const filename = getFilenameFromPath(soundPath);
      return `http://localhost:3001/sounds/${filename}`;
    } else {
      // Acessar arquivo diretamente
      const soundUrl = `file:///${soundPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
      return soundUrl;
    }
  } catch (error) {
    console.error('Erro ao gerar URL do som:', error);
    return '';
  }
};
