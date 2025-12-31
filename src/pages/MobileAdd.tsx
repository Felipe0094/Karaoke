import React, { useEffect, useMemo, useState } from 'react';
import SongSearch from '@/components/SongSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getQueue, getSongs, addToQueue } from '@/services/dataService';
import { Song } from '@/types/song';
import { useToast } from '@/hooks/use-toast';

const MobileAdd: React.FC = () => {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [singerName, setSingerName] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const songs = await getSongs();
      setAllSongs(songs);
      const q = await getQueue();
      setQueueCount(q.length);
    };
    load();
    const interval = setInterval(async () => {
      const q = await getQueue();
      setQueueCount(q.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fullList = useMemo(() => allSongs.slice(0, 3000), [allSongs]);

  const handleAdd = async () => {
    if (!selectedSong || !singerName.trim()) {
      toast({ title: 'Atenção', description: 'Selecione a música e informe o nome', variant: 'destructive' });
      return;
    }
    await addToQueue({ song: selectedSong, singer: singerName.trim() });
    toast({ title: 'Adicionado à fila', description: `${selectedSong.title} para ${singerName}` });
    setSelectedSong(null);
    setSingerName('');
    const q = await getQueue();
    setQueueCount(q.length);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-karaoke-primary text-white px-4 py-3 shadow">
        <div className="max-w-screen-sm mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Adicionar Música</h1>
          <span className="text-sm opacity-90">Fila: {queueCount}</span>
        </div>
      </header>

      <main className="flex-1 px-3 py-4 max-w-screen-sm mx-auto w-full">
        <div className="space-y-4">
          <SongSearch
            onSongSelect={setSelectedSong}
            embedded
            showAddButton
            autoFocus
            onSearchTermChange={setSearchTerm}
          />

          {selectedSong && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selecionada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <div className="font-medium">{selectedSong.title}</div>
                  <div className="text-sm text-gray-600">{selectedSong.artist}</div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Seu nome"
                    value={singerName}
                    onChange={(e) => setSingerName(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAdd} className="bg-karaoke-primary hover:bg-karaoke-secondary">
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {searchTerm.trim() === '' && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Lista completa</h2>
              <div className="max-h-[60vh] overflow-y-auto rounded border">
                {fullList.map((song) => (
                  <button
                    key={song.id}
                    className="w-full text-left px-3 py-2 border-b hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => setSelectedSong(song)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-karaoke-primary text-white rounded px-2 py-0.5">{song.number}</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{song.title}</div>
                        <div className="text-xs text-gray-600 truncate">{song.artist}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MobileAdd;



