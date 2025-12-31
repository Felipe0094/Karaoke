import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Play } from 'lucide-react';
import { QueueItem } from '@/types/song';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

interface SongQueueProps {
  queue: QueueItem[];
  compact?: boolean;
  hidePlayButton?: boolean;
}

const SongQueue: React.FC<SongQueueProps> = ({ queue, compact = false, hidePlayButton = false }) => {
  const navigate = useNavigate();

  const handlePlaySong = (songNumber: string) => {
    navigate(`/play/${songNumber}`);
  };

  if (queue.length === 0) {
    return (
      <Card className={`${compact ? 'bg-black/30 text-white' : 'bg-white/90'} border-karaoke-primary h-fit`}>
        <CardHeader className="pb-1 px-3 py-2">
          <CardTitle className="flex items-center gap-1 text-karaoke-primary text-sm">
            <Clock className="h-4 w-4" />
            Fila
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <p className={`${compact ? 'text-white/80' : 'text-gray-500'} text-center text-xs`}>
            Nenhuma música na fila
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${compact ? 'bg-black/30 text-white' : 'bg-white/70'} border-karaoke-primary h-fit`}>
      <CardHeader className="pb-1 px-3 py-2">
        <CardTitle className="flex items-center gap-1 text-karaoke-primary text-sm">
          <Clock className="h-4 w-4" />
          Fila
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-200">
          {queue.map((item, index) => (
            <li 
              key={index} 
              className={`px-2 py-1.5 ${index === 0 ? 'bg-karaoke-light/30' : ''} queue-item`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <div className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-karaoke-primary text-white flex items-center justify-center mr-2 text-xs`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`${compact ? 'text-xs font-medium' : 'text-sm font-medium'} truncate`}>
                      {item.song.title}
                    </p>
                    <p className={`${compact ? 'text-xs text-white/70' : 'text-xs text-gray-500'} truncate`}>
                      {item.singer} - {item.song.artist}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!compact && (
                    <div className="text-karaoke-secondary font-mono text-xs">
                      #{item.song.number}
                    </div>
                  )}
                  {!hidePlayButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} text-karaoke-primary hover:text-karaoke-secondary hover:bg-white/10`}
                      onClick={() => handlePlaySong(item.song.number)}
                    >
                      <Play className={`${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default SongQueue;
