export interface Song {
  id: string;
  number: string; // 5 dígitos
  title: string;
  artist: string;
  lyrics: string | null; // Trecho inicial
}

export interface QueueItem {
  id?: string;
  song: Song;
  singer: string;
  queue_position?: number;
  created_at?: string;
}

export interface RankingItem {
  id?: string;
  song: Song;
  singer: string;
  score: number;
  date: string;
  created_at?: string;
}

export interface AppSettings {
  id?: string;
  videosPath: string;
  backgroundImage?: string;
  adminPassword?: string;
  useServer?: boolean; // Nova opção para escolher entre servidor e acesso direto
  soundEffects: {
    low?: string;
    medium?: string;
    high?: string;
    drums?: string; // Som de tambores para a animação
    incomplete?: string; // Som para performance incompleta
  };
  created_at?: string;
}
