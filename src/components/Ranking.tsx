import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RankingItem } from '@/types/song';
import { Star } from 'lucide-react';

interface RankingProps {
  ranking: RankingItem[];
}

const Ranking: React.FC<RankingProps> = ({ ranking }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-karaoke-high';
    if (score >= 75) return 'text-karaoke-primary';
    return 'text-karaoke-accent';
  };

  if (ranking.length === 0) {
    return (
      <Card className="bg-white/90 border-karaoke-primary h-fit">
        <CardHeader className="pb-1 px-3 py-2">
          <CardTitle className="flex items-center gap-1 text-karaoke-primary text-sm">
            <Star className="h-4 w-4" />
            Ranking das Melhores Notas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <p className="text-gray-500 text-center text-xs">
            Nenhuma pontuação registrada ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/90 border-karaoke-primary h-fit">
      <CardHeader className="pb-1 px-3 py-2">
        <CardTitle className="flex items-center gap-1 text-karaoke-primary text-sm">
          <Star className="h-4 w-4" />
          Ranking das Melhores Notas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-200">
          {ranking.map((item, index) => (
            <li key={index} className="px-2 py-1.5 flex items-center">
              <div className="w-6 h-6 rounded-full bg-karaoke-primary text-white flex items-center justify-center mr-2 text-xs">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.singer}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {item.song.title} - {item.song.artist}
                </p>
              </div>
              <div className={`text-base font-bold ${getScoreColor(item.score)}`}>
                {item.score}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default Ranking;
