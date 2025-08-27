import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { QueueItem } from '@/types/song';
import { getQueue, removeFromQueue, clearQueue, moveQueueItem } from '@/services/dataService';
import { ArrowUp, ArrowDown, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const QueueManager = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const loadQueue = async () => {
    try {
      const queueData = await getQueue();
      setQueue(queueData);
      setError(null);
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
      setError('Erro ao carregar a fila. Tente novamente.');
      toast({
        title: "Erro",
        description: "Não foi possível carregar a fila.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    
    // Atualizar a cada 5 segundos
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const handleRemove = async (index: number) => {
    try {
      setLoading(true);
      await removeFromQueue(index);
      await loadQueue();
      toast({
        title: "Sucesso",
        description: "Item removido da fila.",
      });
    } catch (error) {
      console.error('Erro ao remover da fila:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o item da fila.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleClear = async () => {
    if (window.confirm('Tem certeza que deseja limpar toda a fila? Esta ação não pode ser desfeita.')) {
      try {
        setLoading(true);
        const success = await clearQueue();
        
        if (success) {
          setQueue([]);
          toast({
            title: "Sucesso",
            description: "Fila limpa com sucesso.",
          });
        } else {
          throw new Error('Falha ao limpar a fila');
        }
      } catch (error) {
        console.error('Erro ao limpar fila:', error);
        toast({
          title: "Erro",
          description: "Não foi possível limpar a fila. Tente novamente.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    
    try {
      setLoading(true);
      await moveQueueItem(index, index - 1);
      await loadQueue();
    } catch (error) {
      console.error('Erro ao mover item para cima:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover o item para cima.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleMoveDown = async (index: number) => {
    if (index >= queue.length - 1) return;
    
    try {
      setLoading(true);
      await moveQueueItem(index, index + 1);
      await loadQueue();
    } catch (error) {
      console.error('Erro ao mover item para baixo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover o item para baixo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-karaoke-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-600">
        {error}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadQueue}
          className="mt-2"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gerenciar Fila</h2>
        {queue.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleClear}>
            Limpar Fila
          </Button>
        )}
      </div>
      
      {queue.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
          Nenhuma música na fila
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {queue.map((item, index) => (
              <li key={item.id || index} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-karaoke-primary text-white flex items-center justify-center mr-4">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{item.song.title}</p>
                      <p className="text-sm text-gray-500">{item.singer} - {item.song.artist}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || loading}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === queue.length - 1 || loading}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleRemove(index)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default QueueManager;
