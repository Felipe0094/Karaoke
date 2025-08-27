import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchSongs } from '@/services/dataService';
import { Song } from '@/types/song';
import { Search } from 'lucide-react';

interface SongSearchProps {
  onSongSelect: (song: Song) => void;
  embedded?: boolean; // quando true, renderiza resultados dentro do fluxo (não absolute)
  showAddButton?: boolean; // quando true, mostra botão explícito de adicionar
  autoFocus?: boolean; // quando true, foca no input ao montar
  onSearchTermChange?: (term: string) => void; // emite termo para o container
}

const SongSearch: React.FC<SongSearchProps> = ({ onSongSelect, embedded = false, showAddButton = false, autoFocus = false, onSearchTermChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSongs([]);
      setSelectedSong(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const results = await searchSongs(searchTerm, 20);
        if (!cancelled) {
          setFilteredSongs(results);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Erro ao buscar músicas:', error);
          setFilteredSongs([]);
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchTerm]);

  const handleSongClick = (song: Song) => {
    setSelectedSong(song);
    onSongSelect(song);
    // Para modo embutido mantemos a lista visível; no modo padrão, limpa
    if (!embedded) {
      setFilteredSongs([]);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          placeholder="Buscar por número, título ou artista..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (onSearchTermChange) onSearchTermChange(e.target.value);
          }}
          className="pl-10 bg-white/70 border-karaoke-primary focus:border-karaoke-secondary focus-visible:ring-karaoke-light py-6 text-lg"
          ref={inputRef}
          autoFocus={autoFocus}
        />
      </div>

      {isLoading && searchTerm && (
        <div className={`${embedded ? '' : 'absolute'} w-full bg-white mt-1 rounded-md shadow-lg z-10 p-2`}>
          <div className="animate-pulse flex items-center justify-center p-4">
            <p className="text-gray-500">Carregando...</p>
          </div>
        </div>
      )}

      {!isLoading && filteredSongs.length > 0 && (
        <div className={`${embedded ? '' : 'absolute'} w-full bg-white mt-1 rounded-md shadow-lg z-10 max-h-72 overflow-y-auto`}
        >
          <ul className="py-1">
            {filteredSongs.map((song) => (
              <li
                key={song.id}
                className="px-4 py-3 hover:bg-gray-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center cursor-pointer" onClick={() => handleSongClick(song)}>
                    <div className="bg-karaoke-primary text-white rounded px-2 py-1 text-xs mr-2">
                      {song.number}
                    </div>
                    <div>
                      <p className="font-medium">{song.title}</p>
                      <p className="text-sm text-gray-600">{song.artist}</p>
                    </div>
                  </div>
                  {showAddButton && (
                    <Button
                      size="sm"
                      className="bg-karaoke-primary hover:bg-karaoke-secondary text-white"
                      onClick={() => handleSongClick(song)}
                    >
                      Adicionar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && searchTerm && filteredSongs.length === 0 && !selectedSong && (
        <div className="absolute w-full bg-white mt-1 rounded-md shadow-lg z-10 p-4 text-center">
          <p className="text-gray-500">Nenhuma música encontrada</p>
        </div>
      )}

      {selectedSong && searchTerm && (
        <div className="mt-3 p-4 bg-white rounded-md border border-gray-200">
          <div className="flex items-center">
            <div className="bg-karaoke-primary text-white rounded px-2 py-1 text-sm mr-2">
              {selectedSong.number}
            </div>
            <div className="flex-1">
              <p className="font-medium">{selectedSong.title}</p>
              <p className="text-sm text-gray-600">{selectedSong.artist}</p>
              
              {/* Adicionando exibição da letra inicial */}
              {selectedSong.lyrics && (
                <div className="mt-2 p-2 bg-white rounded border border-white italic text-sm">
                  <p className="text-gray-700">{selectedSong.lyrics}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongSearch;
