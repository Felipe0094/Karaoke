import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Song } from '@/types/song';
import { getSongs, addSong, updateSong, deleteSong } from '@/services/dataService';
import AddToQueueModal from '@/components/AddToQueueModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SongTable = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isTableVisible, setIsTableVisible] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song>({ id: '', number: '', title: '', artist: '', lyrics: '' });
  const [showAddToQueueModal, setShowAddToQueueModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  
  useEffect(() => {
    const loadSongs = async () => {
      try {
        const songsData = await getSongs();
        setSongs(songsData);
        setFilteredSongs(songsData);
      } catch (error) {
        console.error('Erro ao carregar músicas:', error);
      }
    };
    
    loadSongs();
  }, []);
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    
    if (term.trim() === '') {
      setFilteredSongs(songs);
      return;
    }
    
    const filtered = songs.filter(song => 
      song.title.toLowerCase().includes(term) || 
      song.artist.toLowerCase().includes(term) || 
      song.number.includes(term)
    );
    
    setFilteredSongs(filtered);
  };
  
  const handleEdit = (song: Song) => {
    setCurrentSong(song);
    setIsEditing(true);
    setIsAdding(false);
  };
  
  const handleAdd = () => {
    setCurrentSong({ id: '', number: '', title: '', artist: '', lyrics: '' });
    setIsAdding(true);
    setIsEditing(false);
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta música?')) {
      try {
        await deleteSong(id);
        const updatedSongs = await getSongs();
        setSongs(updatedSongs);
        setFilteredSongs(updatedSongs);
      } catch (error) {
        console.error('Erro ao deletar música:', error);
      }
    }
  };

  const handleAddToQueue = (song: Song) => {
    setSelectedSong(song);
    setShowAddToQueueModal(true);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSong(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSave = async () => {
    try {
      if (isAdding) {
        const { id, ...songWithoutId } = currentSong;
        await addSong(songWithoutId);
      } else if (isEditing) {
        await updateSong(currentSong);
      }
      
      const updatedSongs = await getSongs();
      setSongs(updatedSongs);
      setFilteredSongs(updatedSongs);
      setIsEditing(false);
      setIsAdding(false);
    } catch (error) {
      console.error('Erro ao salvar música:', error);
    }
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setIsAdding(false);
  };
  
  // Define o formulário de edição ou adição
  const renderForm = () => (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">{isAdding ? 'Adicionar Nova Música' : 'Editar Música'}</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="number" className="text-sm font-medium text-gray-700 mb-1 block">Número</label>
          <Input 
            id="number" 
            name="number" 
            value={currentSong.number}
            onChange={handleInputChange}
            placeholder="00000" 
          />
        </div>
        
        <div>
          <label htmlFor="title" className="text-sm font-medium text-gray-700 mb-1 block">Título</label>
          <Input 
            id="title" 
            name="title" 
            value={currentSong.title}
            onChange={handleInputChange}
            placeholder="Título da música" 
          />
        </div>
      </div>
      
      <div className="mb-4">
        <label htmlFor="artist" className="text-sm font-medium text-gray-700 mb-1 block">Artista</label>
        <Input 
          id="artist" 
          name="artist" 
          value={currentSong.artist}
          onChange={handleInputChange}
          placeholder="Nome do artista" 
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="lyrics" className="text-sm font-medium text-gray-700 mb-1 block">Trecho da letra</label>
        <Textarea 
          id="lyrics" 
          name="lyrics" 
          value={currentSong.lyrics}
          onChange={handleInputChange}
          placeholder="Trecho inicial da letra" 
          rows={3}
        />
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <Button 
            onClick={() => setIsTableVisible(!isTableVisible)}
            variant="outline"
          >
            {isTableVisible ? 'Ocultar Tabela' : 'Mostrar Tabela'}
          </Button>
          <div className="w-64">
            <Input
              placeholder="Buscar músicas..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
        
        <Button onClick={handleAdd}>Adicionar Música</Button>
      </div>
      
      {(isEditing || isAdding) && renderForm()}
      
      {isTableVisible && (
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Músicas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artista</th>
                    <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right w-48">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSongs.map((song) => (
                    <tr key={song.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{song.number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{song.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{song.artist}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1 w-48">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleAddToQueue(song)} 
                          className="text-green-600 hover:text-green-900"
                        >
                          Adicionar à Fila
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(song)} className="text-blue-600 hover:text-blue-900">
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(song.id)} className="text-red-600 hover:text-red-900">
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))}
                  
                  {filteredSongs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                        Nenhuma música encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AddToQueueModal
        song={selectedSong}
        isOpen={showAddToQueueModal}
        onClose={() => setShowAddToQueueModal(false)}
        onSuccess={async () => {
          setShowAddToQueueModal(false);
          setSelectedSong(null);
        }}
      />
    </div>
  );
};

export default SongTable;
