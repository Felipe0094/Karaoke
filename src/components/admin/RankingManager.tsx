import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RankingItem } from '@/types/song';
import { getRanking, clearRanking, removeFromRanking } from '@/services/dataService';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';

const RankingManager = () => {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const loadRanking = async () => {
    try {
      // Carregar mais itens no gerenciador para permitir limpeza completa
      const rankingData = await getRanking(100);
      setRanking(rankingData);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o ranking.",
        variant: "destructive"
      });
    }
  };
  
  useEffect(() => {
    loadRanking();
  }, []);
  
  const handleRemoveItem = async (id: string) => {
    console.log('Iniciando remoção do item:', id);
    // Removida a confirmação para agilizar o processo e evitar bloqueios de UI
    try {
      setRemovingId(id);
      const success = await removeFromRanking(id);
      
      if (success) {
        console.log('Item removido com sucesso, recarregando ranking...');
        await loadRanking(); // Recarregar o ranking
        toast({
          title: "Sucesso",
          description: "Pontuação removida do ranking.",
        });
      } else {
        throw new Error('Falha ao remover a pontuação');
      }
    } catch (error) {
      console.error('Erro ao remover pontuação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a pontuação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setRemovingId(null);
    }
  };
  
  const handleClear = async () => {
    if (window.confirm('Tem certeza que deseja limpar todo o ranking? Esta ação não pode ser desfeita.')) {
      try {
        setLoading(true);
        const success = await clearRanking();
        
        if (success) {
          setRanking([]);
          toast({
            title: "Sucesso",
            description: "Ranking limpo com sucesso.",
          });
        } else {
          throw new Error('Falha ao limpar o ranking');
        }
      } catch (error) {
        console.error('Erro ao limpar ranking:', error);
        toast({
          title: "Erro",
          description: "Não foi possível limpar o ranking. Tente novamente.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
    } catch (error) {
      return "Data desconhecida";
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 91) return 'text-green-600';
    if (score >= 81) return 'text-blue-600';
    return 'text-orange-500';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-karaoke-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gerenciar Ranking</h2>
        {ranking.length > 0 && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleClear}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Limpando...
              </>
            ) : (
              'Limpar Ranking'
            )}
          </Button>
        )}
      </div>
      
      {ranking.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
          Nenhuma pontuação no ranking
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantor</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Música</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pontuação</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ranking.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}º
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.singer}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{item.song.title}</div>
                    <div className="text-sm text-gray-500">{item.song.artist}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-semibold ${getScoreColor(item.score)}`}>
                      {item.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => item.id && handleRemoveItem(item.id)}
                      disabled={!item.id || removingId === item.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {removingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RankingManager;
