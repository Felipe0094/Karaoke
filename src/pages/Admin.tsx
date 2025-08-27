import React, { useState, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import SongTable from '@/components/admin/SongTable';
import QueueManager from '@/components/admin/QueueManager';
import RankingManager from '@/components/admin/RankingManager';
import SettingsManager from '@/components/admin/SettingsManager';
import { Loader2 } from 'lucide-react';

// Componente de loading
const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-karaoke-primary" />
  </div>
);

const Admin = () => {
  const [activeTab, setActiveTab] = useState('songs');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto p-4 py-8">
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-karaoke-primary">Painel de Administração</h1>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-3xl mx-auto">
              <TabsTrigger value="songs">Músicas</TabsTrigger>
              <TabsTrigger value="queue">Fila</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>
            
            <Suspense fallback={<LoadingSpinner />}>
              <TabsContent value="songs" className="bg-white p-6 rounded-lg shadow-md">
                {activeTab === 'songs' && <SongTable />}
              </TabsContent>
              
              <TabsContent value="queue" className="space-y-4">
                {activeTab === 'queue' && <QueueManager />}
              </TabsContent>
              
              <TabsContent value="ranking" className="space-y-4">
                {activeTab === 'ranking' && <RankingManager />}
              </TabsContent>
              
              <TabsContent value="settings" className="space-y-4">
                {activeTab === 'settings' && <SettingsManager />}
              </TabsContent>
            </Suspense>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
