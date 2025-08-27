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

// Resolve base URL do servidor API (suporta produção com URL remota via env)
const getServerBaseUrl = (): string => {
  // Permitir configuração via variável de ambiente do Vite
  const envBase = (import.meta as any)?.env?.VITE_SERVER_BASE_URL as string | undefined;
  if (envBase && typeof envBase === 'string' && envBase.trim()) {
    return envBase.replace(/\/$/, '');
  }
  // Fallback: usar host atual com porta 3001 (útil em LAN)
  try {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  } catch {
    return `http://localhost:3001`;
  }
};

// Funções de Fila usando Supabase
export const getQueue = async (): Promise<QueueItem[]> => {
  try {
    // Ordena por posição e depois por created_at
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .order('queue_position', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    // Mapear para QueueItem com Song resolvida
    const items = await Promise.all(rows.map(async (row: any): Promise<QueueItem> => {
      const song = (await getSongByNumber(row.song_id)) || {
        id: row.song_id,
        number: row.song_id,
        title: 'Música não encontrada',
        artist: '-',
        lyrics: null,
      };
      return {
        id: row.id,
        song,
        singer: row.singer_name,
        queue_position: row.queue_position || undefined,
        created_at: row.created_at || undefined,
      };
    }));
    return normalizeQueuePositions(items);
  } catch (e) {
    console.error('Erro ao buscar fila (supabase):', e);
    return [];
  }
};

export const addToQueue = async (queueItem: { song: Song; singer: string }): Promise<QueueItem | null> => {
  try {
    // Obter próxima posição
    const { data: maxRows, error: errMax } = await supabase
      .from('queue')
      .select('queue_position')
      .order('queue_position', { ascending: false })
      .limit(1);
    if (errMax) throw errMax;
    const nextPosition = (maxRows && maxRows[0]?.queue_position ? maxRows[0].queue_position : 0) + 1;

    const insert = {
      song_id: queueItem.song.number,
      singer_name: queueItem.singer,
      queue_position: nextPosition,
    };
    const { data, error } = await supabase
      .from('queue')
      .insert([insert])
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      song: queueItem.song,
      singer: data.singer_name,
      queue_position: data.queue_position || undefined,
      created_at: data.created_at || undefined,
    };
  } catch (e) {
    console.error('Erro ao adicionar à fila (supabase):', e);
    return null;
  }
};

export const removeFromQueue = async (index: number): Promise<boolean> => {
  try {
    // Buscar fila ordenada e obter id pelo índice
    const { data: rows, error } = await supabase
      .from('queue')
      .select('id')
      .order('queue_position', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!rows || index < 0 || index >= rows.length) return false;
    const id = rows[index].id;
    const { error: delErr } = await supabase.from('queue').delete().eq('id', id);
    if (delErr) throw delErr;
    // Normalizar posições
    await normalizeQueuePositionsInDb();
    return true;
  } catch (e) {
    console.error('Erro ao remover da fila (supabase):', e);
    return false;
  }
};

export const clearQueue = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Erro ao limpar fila (supabase):', e);
    return false;
  }
};

export const moveQueueItem = async (fromIndex: number, toIndex: number): Promise<boolean> => {
  try {
    const { data: rows, error } = await supabase
      .from('queue')
      .select('id')
      .order('queue_position', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!rows || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) return false;

    const order = rows.map(r => r.id);
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);

    // Atualizar posições sequencialmente
    await Promise.all(order.map((id, idx) => supabase
      .from('queue')
      .update({ queue_position: idx + 1 })
      .eq('id', id)));

    return true;
  } catch (e) {
    console.error('Erro ao mover item na fila (supabase):', e);
    return false;
  }
};

// Normaliza posições na base conforme created_at
const normalizeQueuePositionsInDb = async (): Promise<void> => {
  try {
    const { data: rows, error } = await supabase
      .from('queue')
      .select('id')
      .order('created_at', { ascending: true });
    if (error) throw error;
    await Promise.all((rows || []).map((r: any, idx: number) => supabase
      .from('queue')
      .update({ queue_position: idx + 1 })
      .eq('id', r.id)));
  } catch (e) {
    console.error('Erro ao normalizar posições (supabase):', e);
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
    const { data, error } = await supabase
      .from('ranking')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const items = await Promise.all(rows.map(async (row: any): Promise<RankingItem> => {
      const song = (await getSongByNumber(row.song_id)) || {
        id: row.song_id,
        number: row.song_id,
        title: 'Música não encontrada',
        artist: '-',
        lyrics: null,
      };
      return {
        id: row.id,
        song,
        singer: row.singer_name,
        score: row.score,
        date: row.created_at,
        created_at: row.created_at,
      };
    }));
    return items;
  } catch (e) {
    console.error('Erro ao buscar ranking (supabase):', e);
    return [];
  }
};

// Função para adicionar uma pontuação ao ranking
export const addToRanking = async (rankingItem: { song: Song; singer: string; score: number }): Promise<RankingItem | null> => {
  try {
    const payload = {
      song_id: rankingItem.song.number,
      singer_name: rankingItem.singer,
      score: rankingItem.score,
    };
    const { data, error } = await supabase
      .from('ranking')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      song: rankingItem.song,
      singer: data.singer_name,
      score: data.score,
      date: data.created_at,
      created_at: data.created_at,
    };
  } catch (e) {
    console.error('Erro ao adicionar ao ranking (supabase):', e);
    return null;
  }
};

// Função para limpar todo o ranking
export const clearRanking = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('ranking').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Erro ao limpar ranking (supabase):', e);
    return false;
  }
};

// Função para remover um item específico do ranking
export const removeFromRanking = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('ranking').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Erro ao remover item do ranking (supabase):', e);
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
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      const row: any = data[0];
      // sound_effects jsonb → AppSettings.soundEffects
      const soundEffects = (row.sound_effects || {}) as AppSettings['soundEffects'];
      const app: AppSettings = {
        id: row.id,
        videosPath: row.videos_path || '',
        backgroundImage: row.background_image || undefined,
        adminPassword: row.admin_password || undefined,
        useServer: row.use_server ?? true,
        soundEffects,
        created_at: row.created_at || undefined,
      };
      return app;
    }
    // Criar defaults se não existir
    const defaults: AppSettings = {
      videosPath: '',
      backgroundImage: undefined,
      soundEffects: {},
      adminPassword: 'admin123',
      useServer: true,
      created_at: new Date().toISOString(),
    };
    const payload = {
      videos_path: defaults.videosPath,
      background_image: defaults.backgroundImage || null,
      sound_effects: defaults.soundEffects,
      admin_password: defaults.adminPassword,
      use_server: defaults.useServer,
    };
    const { data: inserted, error: insErr } = await supabase
      .from('settings')
      .insert([payload])
      .select('*')
      .single();
    if (insErr) throw insErr;
    return {
      id: inserted.id,
      videosPath: inserted.videos_path || '',
      backgroundImage: inserted.background_image || undefined,
      adminPassword: inserted.admin_password || undefined,
      useServer: inserted.use_server ?? true,
      soundEffects: (inserted.sound_effects || {}) as any,
      created_at: inserted.created_at || undefined,
    };
  } catch (error) {
    console.error('Erro ao buscar configurações (supabase):', error);
    return null;
  }
};

// Função para atualizar as configurações do app
export const updateSettings = async (settings: AppSettings): Promise<AppSettings | null> => {
  try {
    const payload = {
      videos_path: settings.videosPath || '',
      background_image: settings.backgroundImage || null,
      sound_effects: settings.soundEffects || {},
      admin_password: settings.adminPassword || null,
      use_server: settings.useServer ?? true,
    };
    let upsertResult;
    if (settings.id) {
      upsertResult = await supabase
        .from('settings')
        .update(payload)
        .eq('id', settings.id)
        .select('*')
        .single();
    } else {
      upsertResult = await supabase
        .from('settings')
        .insert([payload])
        .select('*')
        .single();
    }
    const { data, error } = upsertResult as any;
    if (error) throw error;
    const saved: AppSettings = {
      id: data.id,
      videosPath: data.videos_path || '',
      backgroundImage: data.background_image || undefined,
      adminPassword: data.admin_password || undefined,
      useServer: data.use_server ?? true,
      soundEffects: (data.sound_effects || {}) as any,
      created_at: data.created_at || undefined,
    };
    return saved;
  } catch (error) {
    console.error('Erro ao atualizar configurações (supabase):', error);
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
