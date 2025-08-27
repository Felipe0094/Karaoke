import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SongSearch from '@/components/SongSearch';
import SongQueue from '@/components/SongQueue';
import Ranking from '@/components/Ranking';
import AddToQueueModal from '@/components/AddToQueueModal';
import Header from '@/components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { Song, QueueItem, RankingItem } from '@/types/song';
import { getQueue, getRanking, getSettings, AppSettings } from '@/services/dataService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Index = () => {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showAddToQueueModal, setShowAddToQueueModal] = useState(false);
  const [showSingerInputModal, setShowSingerInputModal] = useState(false);
  const [singerName, setSingerName] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const navigate = useNavigate();

  // Carrega dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const queueData = await getQueue();
        const rankingData = await getRanking();
        const settingsData = await getSettings();
        
        setQueue(queueData);
        setRanking(rankingData);
        setSettings(settingsData);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    };
    
    loadInitialData();
  }, []);

  // Atualiza a fila e o ranking a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const queueData = await getQueue();
        const rankingData = await getRanking();
        const settingsData = await getSettings();
        
        setQueue(queueData);
        setRanking(rankingData);
        setSettings(settingsData);
      } catch (error) {
        console.error('Erro ao atualizar dados:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSongSelect = (song: Song) => {
    setSelectedSong(song);
  };

  const handleStartSong = () => {
    if (selectedSong) {
      setShowSingerInputModal(true);
    }
  };

  const handleConfirmStartSong = () => {
    if (selectedSong && singerName.trim()) {
      // Salvar o nome do cantor no localStorage para usar na página de reprodução
      localStorage.setItem('currentSinger', singerName.trim());
      setShowSingerInputModal(false);
      setSingerName('');
      navigate(`/play/${selectedSong.number}`);
    }
  };

  const handleAddToQueue = () => {
    setShowAddToQueueModal(true);
  };

  const handleQueueSuccess = async () => {
    setShowAddToQueueModal(false);
    const updatedQueue = await getQueue();
    setQueue(updatedQueue);
  };

  return (
    <div 
      className="karaoke-container h-screen flex flex-col overflow-hidden" 
      style={settings?.backgroundImage ? { backgroundImage: `url(${settings.backgroundImage})` } : {}}
    >
      <Header />
      
      <main className="flex-1 container mx-auto p-4 flex flex-col items-center overflow-hidden">
        <div className="w-full max-w-5xl h-full flex flex-col">
          <div className="mb-6">
            <SongSearch onSongSelect={handleSongSelect} />
            <div className="mt-4 self-start md:fixed md:top-4 md:left-4 md:z-50">
              <div className="bg-white p-2 rounded shadow">
                <QRCodeSVG value={`${window.location.origin}/add`} size={96} includeMargin />
              </div>
            </div>
            
            {selectedSong && (
              <div className="flex justify-center mt-6 gap-4">
                <Button 
                  className="bg-karaoke-primary hover:bg-karaoke-secondary" 
                  onClick={handleStartSong}
                >
                  Iniciar Música
                </Button>
                <Button 
                  variant="outline" 
                  className="border-karaoke-primary text-karaoke-primary hover:bg-karaoke-light" 
                  onClick={handleAddToQueue}
                >
                  Adicionar à Fila
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min">
            <Ranking ranking={ranking.slice(0, 5)} />
            <SongQueue queue={queue.slice(0, 5)} />
          </div>
        </div>
      </main>
      
      <AddToQueueModal 
        song={selectedSong} 
        isOpen={showAddToQueueModal}
        onClose={() => setShowAddToQueueModal(false)}
        onSuccess={handleQueueSuccess}
      />

      {/* Modal para informar o cantor ao iniciar música diretamente */}
      <Dialog open={showSingerInputModal} onOpenChange={setShowSingerInputModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quem vai cantar?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSong && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-medium">{selectedSong.title}</p>
                <p className="text-sm text-gray-500">{selectedSong.artist}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="singer-name">Nome do cantor</Label>
              <Input
                id="singer-name"
                placeholder="Digite o nome do cantor"
                value={singerName}
                onChange={(e) => setSingerName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && singerName.trim()) {
                    handleConfirmStartSong();
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSingerInputModal(false);
                  setSingerName('');
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmStartSong}
                disabled={!singerName.trim()}
                className="flex-1 bg-karaoke-primary hover:bg-karaoke-secondary"
              >
                Iniciar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
