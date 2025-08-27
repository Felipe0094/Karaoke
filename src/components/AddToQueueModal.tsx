
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Song, QueueItem } from '@/types/song';
import { addToQueue } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';

interface AddToQueueModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddToQueueModal: React.FC<AddToQueueModalProps> = ({ song, isOpen, onClose, onSuccess }) => {
  const [singerName, setSingerName] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!song) return;
    if (!singerName.trim()) {
      toast({
        title: "Atenção!",
        description: "Por favor, informe o nome do cantor.",
        variant: "destructive",
      });
      return;
    }

    const queueItem: QueueItem = {
      song,
      singer: singerName,
    };

    addToQueue(queueItem);
    toast({
      title: "Adicionado à fila!",
      description: `${song.title} foi adicionada à fila para ${singerName}.`,
    });
    setSingerName('');
    onSuccess();
  };

  return (
    <Dialog open={isOpen && !!song} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar à Fila</DialogTitle>
        </DialogHeader>
        {song && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="text-lg font-semibold text-karaoke-primary">{song.title}</div>
              <div className="text-sm text-gray-600">{song.artist}</div>
            </div>
            <div className="mb-4">
              <Label htmlFor="singer-name">Quem vai cantar?</Label>
              <Input
                id="singer-name"
                value={singerName}
                onChange={(e) => setSingerName(e.target.value)}
                placeholder="Digite seu nome"
                className="mt-1"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} type="button">
                Cancelar
              </Button>
              <Button type="submit" className="bg-karaoke-primary hover:bg-karaoke-secondary">
                Adicionar à Fila
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddToQueueModal;
