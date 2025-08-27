import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { getSettings, updateSettings, AppSettings } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Music, Save } from 'lucide-react';
import debounce from 'lodash/debounce';

const SettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({ 
    soundEffects: {
      low: '',
      medium: '',
      high: '',
      drums: '',
      incomplete: ''
    }, 
    adminPassword: "admin123", 
    videosPath: "",
    useServer: true // Nova opção
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const lowScoreSoundRef = useRef<HTMLInputElement>(null);
  const mediumScoreSoundRef = useRef<HTMLInputElement>(null);
  const highScoreSoundRef = useRef<HTMLInputElement>(null);
  const drumsSoundRef = useRef<HTMLInputElement>(null);
  const incompleteSoundRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetchedSettings = await getSettings();
        if (fetchedSettings) {
          setSettings(fetchedSettings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as configurações.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateSettings(settings);
      
      if (result) {
        setHasChanges(false);
        toast({
          title: "Configurações salvas",
          description: "As configurações foram atualizadas com sucesso."
        });
      } else {
        throw new Error("Falha ao salvar configurações");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVideosPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = {
      ...settings,
      videosPath: e.target.value,
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleBackgroundImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Erro",
          description: "A imagem deve ter no máximo 5MB.",
          variant: "destructive"
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          const newSettings = {
            ...settings,
            backgroundImage: event.target.result,
          };
          setSettings(newSettings);
          setHasChanges(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSoundPathChange = (type: keyof AppSettings['soundEffects'], value: string) => {
    const newSettings = {
      ...settings,
      soundEffects: {
        ...settings.soundEffects,
        [type]: value
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const clearBackgroundImage = () => {
    const newSettings = {
      ...settings,
      backgroundImage: undefined,
    };
    setSettings(newSettings);
    setHasChanges(true);
    if (bgImageInputRef.current) {
      bgImageInputRef.current.value = '';
    }
  };

  const clearSoundEffect = (type: 'low' | 'medium' | 'high' | 'drums' | 'incomplete', ref: React.RefObject<HTMLInputElement>) => {
    const newSettings = {
      ...settings,
      soundEffects: {
        ...settings.soundEffects,
        [type]: undefined,
      },
    };
    setSettings(newSettings);
    setHasChanges(true);
    if (ref.current) {
      ref.current.value = '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-karaoke-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Configurações do Sistema</span>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-karaoke-primary" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Modo de Acesso aos Arquivos */}
        <div className="space-y-2">
          <Label>Modo de Acesso aos Arquivos</Label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="accessMode"
                checked={settings.useServer}
                onChange={() => {
                  setSettings({ ...settings, useServer: true });
                  setHasChanges(true);
                }}
              />
              <span>Usar Servidor Local (Recomendado)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="accessMode"
                checked={!settings.useServer}
                onChange={() => {
                  setSettings({ ...settings, useServer: false });
                  setHasChanges(true);
                }}
              />
              <span>Acessar Arquivos Diretamente</span>
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>Servidor Local:</strong> Melhor performance e streaming. Requer iniciar o servidor com "node server.js".<br/>
            <strong>Acesso Direto:</strong> Mais simples, mas pode ter limitações de segurança do navegador.
          </p>
        </div>

        {/* Caminho dos Vídeos MP4 */}
        <div className="space-y-2">
          <Label htmlFor="videos-path">Caminho dos Arquivos MP4</Label>
          <Input
            id="videos-path"
            type="text"
            value={settings.videosPath}
            onChange={handleVideosPathChange}
            placeholder="Ex: D:/KARAOKEV3/musicas"
          />
          <p className="text-sm text-muted-foreground">
            Informe o caminho da pasta onde os arquivos MP4 estão armazenados.
            Use barras normais (/) em vez de barras invertidas (\).
          </p>
        </div>

        <Separator />

        {/* Imagem de Fundo */}
        <div className="space-y-2">
          <Label htmlFor="background-image">Imagem de Fundo</Label>
          <div className="flex items-center gap-2">
            <Input
              id="background-image"
              type="file"
              accept="image/*"
              ref={bgImageInputRef}
              onChange={handleBackgroundImageChange}
            />
            {settings.backgroundImage && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearBackgroundImage}
              >
                Limpar
              </Button>
            )}
          </div>
          {settings.backgroundImage && (
            <div className="mt-2 border rounded-md p-2">
              <div className="text-sm font-medium mb-1">Imagem atual:</div>
              <img 
                src={settings.backgroundImage} 
                alt="Imagem de fundo" 
                className="max-h-24 rounded-md"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Configurações de Som */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Music className="h-5 w-5" />
            Configurações de Som
          </h3>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="high-score-sound">Som para Nota Alta (91-100)</Label>
              <Input
                id="high-score-sound"
                type="text"
                value={settings.soundEffects.high || ''}
                onChange={(e) => handleSoundPathChange('high', e.target.value)}
                placeholder="Ex: D:/KARAOKEV3/audio/acima de 90.mp3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medium-score-sound">Som para Nota Média (75-90)</Label>
              <Input
                id="medium-score-sound"
                type="text"
                value={settings.soundEffects.medium || ''}
                onChange={(e) => handleSoundPathChange('medium', e.target.value)}
                placeholder="Ex: D:/KARAOKEV3/audio/75 a 90.mp3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="low-score-sound">Som para Nota Baixa (60-75)</Label>
              <Input
                id="low-score-sound"
                type="text"
                value={settings.soundEffects.low || ''}
                onChange={(e) => handleSoundPathChange('low', e.target.value)}
                placeholder="Ex: D:/KARAOKEV3/audio/abaixo de 75.mp3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="drums-sound">Som de Tambores (Animação)</Label>
              <Input
                id="drums-sound"
                type="text"
                value={settings.soundEffects.drums || ''}
                onChange={(e) => handleSoundPathChange('drums', e.target.value)}
                placeholder="Ex: D:/KARAOKEV3/sounds/drums.mp3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incomplete-sound">Som para Performance Incompleta</Label>
              <Input
                id="incomplete-sound"
                type="text"
                value={settings.soundEffects.incomplete || ''}
                onChange={(e) => handleSoundPathChange('incomplete', e.target.value)}
                placeholder="Ex: D:/KARAOKEV3/sounds/incomplete.mp3"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-2">
            Informe o caminho completo para cada arquivo de som (com extensão). Use barras normais (/) em vez de barras invertidas (\).
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-4">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-karaoke-primary hover:bg-karaoke-secondary text-white"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SettingsManager;
