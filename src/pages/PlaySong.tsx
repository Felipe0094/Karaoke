import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SongQueue from '@/components/SongQueue';
import { Input } from '@/components/ui/input';
import { getSongByNumber, getQueue, generateScore, addToRanking, removeFromQueue, getSettings, searchSongs, addToQueue, getVideoUrl, getSoundUrl } from '@/services/dataService';
import { Song, QueueItem, AppSettings } from '@/types/song';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Plus, X } from 'lucide-react';

// Helper function to extract filename from path
const getFilenameFromPath = (filepath: string): string => {
  // Remove any quotes from the entire path
  const cleanPath = filepath.replace(/["']/g, '');
  // Handle both forward and backward slashes
  const normalizedPath = cleanPath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || cleanPath;
};

const PlaySong = () => {
  const { songNumber } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnimatingScore, setIsAnimatingScore] = useState(false);
  const [displayedScore, setDisplayedScore] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isPerformanceIncomplete, setIsPerformanceIncomplete] = useState(false);
  const drumSoundRef = useRef<HTMLAudioElement | null>(null);
  const incompleteSoundRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showSingerInput, setShowSingerInput] = useState(false);
  const [singerName, setSingerName] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allowPause, setAllowPause] = useState(false);

  useEffect(() => {
    const loadSong = async () => {
      if (songNumber) {
        console.log('Carregando música número:', songNumber);
        const song = await getSongByNumber(songNumber);
        if (song) {
          console.log('Música encontrada:', song);
          setSong(song);
          
          // Buscar configurações para determinar o caminho do vídeo
          const settingsData = await getSettings();
          setSettings(settingsData);

          // Construir URL do vídeo usando o caminho configurado
          const videoUrl = await getVideoUrl(song.number);
          console.log('URL do vídeo:', videoUrl);
          setVideoUrl(videoUrl);

          // Buscar a fila atual
          const queueData = await getQueue();
          setQueue(queueData);

          // Se a música está na fila, remover da fila
          const songInQueue = queueData.find(item => item.song.number === songNumber);
          if (songInQueue) {
            const queueIndex = queueData.indexOf(songInQueue);
            await removeFromQueue(queueIndex);
            const updatedQueue = await getQueue();
            setQueue(updatedQueue);
            // Usar o nome do cantor da fila
            setSingerName(songInQueue.singer);
          } else {
            // Verificar se há um cantor salvo no localStorage (música iniciada diretamente)
            const savedSinger = localStorage.getItem('currentSinger');
            if (savedSinger) {
              setSingerName(savedSinger);
              // Limpar o localStorage após ler
              localStorage.removeItem('currentSinger');
            } else {
              setSingerName('Solo');
            }
          }
        } else {
          console.error('Música não encontrada');
          navigate('/');
        }
      }
    };

    loadSong();
  }, [songNumber, navigate]);

  // Atualizar a fila periodicamente enquanto o vídeo toca
  useEffect(() => {
    const reloadQueue = async () => {
      const q = await getQueue();
      setQueue(q);
    };
    reloadQueue();
    const interval = setInterval(reloadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleVideoStart = () => {
    setStartTime(Date.now());
    // Tentar entrar em tela cheia automaticamente
    try {
      const element = containerRef.current;
      if (!element) return;
      const anyElement: any = element as any;
      const requestFullscreen = anyElement.requestFullscreen 
        || anyElement.webkitRequestFullscreen 
        || anyElement.mozRequestFullScreen 
        || anyElement.msRequestFullscreen;
      if (requestFullscreen) {
        requestFullscreen.call(anyElement).then(() => {
          // Ocultar mensagem do navegador após entrar em fullscreen
          const style = document.createElement('style');
          style.id = 'fullscreen-hide-styles';
          style.textContent = `
            /* Ocultar mensagem do navegador sobre ESC */
            ::-webkit-full-screen {
              background: black;
            }
            ::-webkit-full-screen * {
              background: black;
            }
            /* Ocultar mensagens de fullscreen do Firefox */
            :-moz-full-screen {
              background: black;
            }
            /* Ocultar mensagens de fullscreen do Edge/IE */
            :-ms-fullscreen {
              background: black;
            }
            /* Ocultar mensagens de fullscreen padrão */
            :fullscreen {
              background: black;
            }
            /* Ocultar qualquer overlay do navegador */
            .fullscreen-overlay {
              display: none !important;
            }
          `;
          document.head.appendChild(style);
        });
      }
    } catch (e) {
      // Ignorar falhas de fullscreen (políticas de navegador)
    }
  };

  // Tentar iniciar reprodução assim que a URL do vídeo estiver disponível
  useEffect(() => {
    if (!videoUrl) return;
    const tryAutoPlay = async () => {
      try {
        setVideoLoadError(null);
        setNeedsUserGesture(false);
        await videoRef.current?.play();
      } catch (err) {
        // Chrome pode bloquear autoplay com áudio; exigir gesto do usuário
        setNeedsUserGesture(true);
      }
    };
    tryAutoPlay();
  }, [videoUrl]);

  // Impedir que duplo clique no vídeo altere o fullscreen nativo do <video>
  // e normalizar para manter o fullscreen no contêiner, preservando os overlays
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Desabilitar fullscreen/PiP nativos e outros controles indesejados
    try {
      video.setAttribute('controlsList', 'nofullscreen noplaybackrate nodownload');
      video.setAttribute('disablePictureInPicture', 'true');
    } catch {}

    // Ocultar mensagem do navegador sobre ESC para sair do fullscreen
    const hideFullscreenMessage = () => {
      // Adicionar estilos CSS para ocultar mensagens do navegador
      const style = document.createElement('style');
      style.id = 'fullscreen-hide-styles';
      style.textContent = `
        /* Ocultar mensagem do navegador sobre ESC */
        ::-webkit-full-screen {
          background: black;
        }
        ::-webkit-full-screen * {
          background: black;
        }
        /* Ocultar mensagens de fullscreen do Firefox */
        :-moz-full-screen {
          background: black;
        }
        /* Ocultar mensagens de fullscreen do Edge/IE */
        :-ms-fullscreen {
          background: black;
        }
        /* Ocultar mensagens de fullscreen padrão */
        :fullscreen {
          background: black;
        }
        /* Ocultar qualquer overlay do navegador */
        .fullscreen-overlay {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    };

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Garantir fullscreen no container, não no vídeo
      const doc: any = document as any;
      const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      if (fsEl && fsEl !== container) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exit) exit.call(document);
      }
      const request = (container as any).requestFullscreen 
        || (container as any).webkitRequestFullscreen 
        || (container as any).mozRequestFullScreen 
        || (container as any).msRequestFullscreen;
      if (request) {
        request.call(container).then(() => {
          hideFullscreenMessage();
        });
      }
    };

    const onFsChange = () => {
      const doc: any = document as any;
      const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      if (videoRef.current && fsEl === videoRef.current) {
        // Migrar fullscreen do vídeo para o contêiner
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exit) exit.call(document);
        const request = (container as any).requestFullscreen 
          || (container as any).webkitRequestFullscreen 
          || (container as any).mozRequestFullScreen 
          || (container as any).msRequestFullscreen;
        if (request) {
          request.call(container).then(() => {
            hideFullscreenMessage();
          });
        }
      } else if (fsEl === container) {
        hideFullscreenMessage();
      }
    };

    video.addEventListener('dblclick', handleDblClick);
    document.addEventListener('fullscreenchange', onFsChange as any);
    document.addEventListener('webkitfullscreenchange', onFsChange as any);
    document.addEventListener('mozfullscreenchange', onFsChange as any);
    document.addEventListener('MSFullscreenChange', onFsChange as any);

    return () => {
      video.removeEventListener('dblclick', handleDblClick);
      document.removeEventListener('fullscreenchange', onFsChange as any);
      document.removeEventListener('webkitfullscreenchange', onFsChange as any);
      document.removeEventListener('mozfullscreenchange', onFsChange as any);
      document.removeEventListener('MSFullscreenChange', onFsChange as any);
      
      // Remover estilos ao desmontar
      const style = document.getElementById('fullscreen-hide-styles');
      if (style) {
        style.remove();
      }
    };
  }, [videoUrl]);

  const handleStartWithGesture = async () => {
    try {
      setVideoLoadError(null);
      if (videoRef.current) {
        await videoRef.current.play();
        setNeedsUserGesture(false);
        // Entrar em fullscreen após gesto do usuário
        try {
          const anyElement: any = containerRef.current as any;
          const requestFullscreen = anyElement.requestFullscreen 
            || anyElement.webkitRequestFullscreen 
            || anyElement.mozRequestFullScreen 
            || anyElement.msRequestFullscreen;
          if (requestFullscreen) {
            requestFullscreen.call(anyElement).then(() => {
              // Ocultar mensagem do navegador após entrar em fullscreen
              const style = document.createElement('style');
              style.id = 'fullscreen-hide-styles';
              style.textContent = `
                /* Ocultar mensagem do navegador sobre ESC */
                ::-webkit-full-screen {
                  background: black;
                }
                ::-webkit-full-screen * {
                  background: black;
                }
                /* Ocultar mensagens de fullscreen do Firefox */
                :-moz-full-screen {
                  background: black;
                }
                /* Ocultar mensagens de fullscreen do Edge/IE */
                :-ms-fullscreen {
                  background: black;
                }
                /* Ocultar mensagens de fullscreen padrão */
                :fullscreen {
                  background: black;
                }
                /* Ocultar qualquer overlay do navegador */
                .fullscreen-overlay {
                  display: none !important;
                }
              `;
              document.head.appendChild(style);
            });
          }
        } catch {}
      }
    } catch (e) {
      setVideoLoadError('Não foi possível iniciar o vídeo. Verifique o caminho e o servidor.');
    }
  };

  // Buscar músicas localmente
  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchSongs(term, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Erro na busca:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToQueue = (song: Song) => {
    setSelectedSong(song);
    setShowSingerInput(true);
  };

  const handleConfirmAddToQueue = async () => {
    if (!selectedSong || !singerName.trim()) return;
    
    try {
      await addToQueue({ song: selectedSong, singer: singerName.trim() });
      // Limpar e fechar
      setSingerName('');
      setSelectedSong(null);
      setShowSingerInput(false);
      setShowSearchPanel(false);
      // Recarregar fila
      const updatedQueue = await getQueue();
      setQueue(updatedQueue);
    } catch (error) {
      console.error('Erro ao adicionar à fila:', error);
    }
  };

  const handleSongEnd = async () => {
    if (!startTime) return;

    const performanceTime = (Date.now() - startTime) / 1000; // Tempo em segundos
    const minimumTime = 30; // 30 segundos

    if (performanceTime < minimumTime) {
      setIsPerformanceIncomplete(true);
      setShowScore(true);
      
      // Tocar som de performance incompleta usando o servidor local
      if (settings?.soundEffects?.incomplete) {
        try {
          console.log("Todas as configurações:", settings);
          console.log("Configurações de som:", settings.soundEffects);
          console.log("Caminho do som incompleto original:", settings.soundEffects.incomplete);
          
          const soundUrl = await getSoundUrl(settings.soundEffects.incomplete);
          console.log("URL final do áudio:", soundUrl);
          
          // Tentar fazer uma requisição fetch primeiro para verificar se o arquivo existe
          fetch(soundUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              console.log("Arquivo de áudio encontrado no servidor");
              
              const audio = new Audio(soundUrl);
              
              audio.onerror = (e) => {
                console.error("Erro ao carregar áudio:", e);
                console.error("Código do erro:", (audio as any).error?.code);
                console.error("Mensagem do erro:", (audio as any).error?.message);
              };
              
              audio.oncanplay = () => {
                console.log("Áudio pronto para tocar");
              };
              
              return audio.play();
            })
            .catch(error => {
              console.error("Erro ao verificar/tocar o arquivo de áudio:", error);
            });
            
        } catch (error) {
          console.error("Erro ao tocar áudio de performance incompleta:", error);
        }
      } else {
        console.log("Nenhum som de performance incompleta configurado");
      }
      
      // Voltar para a página inicial após 6 segundos
      setTimeout(() => {
        navigate('/');
      }, 6000);
      
      return;
    }

    const generatedScore = generateScore();
    setScore(generatedScore);
    
    // Iniciar animação de números aleatórios
    setIsAnimatingScore(true);
    setDisplayedScore(Math.floor(Math.random() * (100 - 60 + 1)) + 60);
    
    // Tocar som de tambores se disponível
    if (settings?.soundEffects?.drums) {
      try {
        // Parar qualquer som anterior de tambores
        if (drumSoundRef.current) {
          try { drumSoundRef.current.pause(); } catch {}
          try { drumSoundRef.current.currentTime = 0; } catch {}
        }
        const soundUrl = await getSoundUrl(settings.soundEffects.drums);
        const audio = new Audio(soundUrl);
        audio.loop = true;
        drumSoundRef.current = audio;
        await audio.play();
      } catch (error) {
        console.error("Erro ao tocar áudio de tambores:", error);
      }
    }
    
    // Esperar 8 segundos para mostrar a pontuação real
    setTimeout(async () => {
      setIsAnimatingScore(false);
      setDisplayedScore(generatedScore);
      setShowScore(true);
      
      // Parar som de tambores ao terminar a animação
      try {
        if (drumSoundRef.current) {
          drumSoundRef.current.pause();
          drumSoundRef.current.currentTime = 0;
          drumSoundRef.current = null;
        }
      } catch {}

      // Tocar som baseado na pontuação
      let soundToPlay: string | undefined;
      
      if (generatedScore >= 91 && settings?.soundEffects?.high) {
        soundToPlay = settings.soundEffects.high;
      } else if (generatedScore >= 75 && settings.soundEffects.medium) {
        soundToPlay = settings.soundEffects.medium;
      } else if (generatedScore >= 60 && settings.soundEffects?.low) {
        soundToPlay = settings.soundEffects.low;
      }
      
      if (soundToPlay) {
        try {
          const soundUrl = await getSoundUrl(soundToPlay);
          const audio = new Audio(soundUrl);
          await audio.play();
        } catch (error) {
          console.error("Erro ao tocar áudio da pontuação:", error);
        }
      }
      
      // Se houver um item na fila, adicione ao ranking e remova da fila
      const processQueue = async () => {
        if (queue.length > 0 && song) {
          await addToRanking({
            song: song,
            singer: queue[0].singer,
            score: generatedScore
          });
          await removeFromQueue(0);
          const updatedQueue = await getQueue();
          setQueue(updatedQueue);
                  } else {
            // Sempre salvar no ranking, mesmo sem fila
            await addToRanking({
              song: song!,
              singer: singerName,
              score: generatedScore
            });
          }
      };
      
      await processQueue();
      
      // Voltar para a página inicial após 6 segundos
      setTimeout(() => {
        navigate('/');
      }, 6000);
    }, 7000);
  };

  // Efeito para atualizar o número aleatório durante a animação
  useEffect(() => {
    if (!isAnimatingScore) return;
    
    const interval = setInterval(() => {
      setDisplayedScore(Math.floor(Math.random() * 100));
    }, 100);
    
    return () => clearInterval(interval);
  }, [isAnimatingScore]);

  // Contagem regressiva para retornar à tela inicial
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown <= 0) {
      navigate('/');
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  const handleStopPerformance = async () => {
    try {
      setAllowPause(true);
      if (videoRef.current) {
        videoRef.current.pause();
      }

      // Checar tempo de execução para lógica de performance incompleta
      const now = Date.now();
      const hasStart = typeof startTime === 'number' && startTime > 0;
      const performanceTime = hasStart ? (now - (startTime as number)) / 1000 : 0;
      const minimumTime = 30;

      if (performanceTime < minimumTime) {
        setIsPerformanceIncomplete(true);
        setShowScore(true);

        // Tocar som de performance incompleta
        if (settings?.soundEffects?.incomplete) {
          try {
            const soundUrl = await getSoundUrl(settings.soundEffects.incomplete);
            fetch(soundUrl)
              .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const audio = new Audio(soundUrl);
                audio.play().catch(() => {});
              })
              .catch(() => {});
          } catch {}
        }

        // Sair de fullscreen, se ativo
        try {
          const doc: any = document as any;
          if (document.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
            const exit = document.exitFullscreen 
              || doc.webkitExitFullscreen 
              || doc.mozCancelFullScreen 
              || doc.msExitFullscreen;
            if (exit) exit.call(document);
          }
        } catch {}

        // Voltar após 6 segundos
        setTimeout(() => {
          navigate('/');
        }, 6000);
        return;
      }

      // Se tempo >= 60s, encerra imediatamente
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      // Executar animação da nota como se fosse fim natural do vídeo
      const generatedScore = generateScore();
      setScore(generatedScore);
      
      // Iniciar animação de números aleatórios
      setIsAnimatingScore(true);
      setDisplayedScore(Math.floor(Math.random() * (100 - 60 + 1)) + 60);
      
      // Tocar som de tambores se disponível
      if (settings?.soundEffects?.drums) {
        try {
          // Parar qualquer som anterior de tambores
          if (drumSoundRef.current) {
            try { drumSoundRef.current.pause(); } catch {}
            try { drumSoundRef.current.currentTime = 0; } catch {}
          }
          const soundUrl = await getSoundUrl(settings.soundEffects.drums);
          const audio = new Audio(soundUrl);
          audio.loop = true;
          drumSoundRef.current = audio;
          await audio.play();
        } catch (error) {
          console.error("Erro ao tocar áudio de tambores:", error);
        }
      }

      // Sair de fullscreen, se ativo
      try {
        const doc: any = document as any;
        if (document.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
          const exit = document.exitFullscreen 
            || doc.webkitExitFullscreen 
            || doc.mozCancelFullScreen 
            || doc.msExitFullscreen;
          if (exit) exit.call(document);
        }
      } catch {}
      
      // Esperar 8 segundos para mostrar a pontuação real
      setTimeout(async () => {
        setIsAnimatingScore(false);
        setDisplayedScore(generatedScore);
        setShowScore(true);
        
        // Parar som de tambores ao terminar a animação
        try {
          if (drumSoundRef.current) {
            drumSoundRef.current.pause();
            drumSoundRef.current.currentTime = 0;
            drumSoundRef.current = null;
          }
        } catch {}

        // Tocar som baseado na pontuação
        let soundToPlay: string | undefined;
        
        if (generatedScore >= 91 && settings?.soundEffects?.high) {
          soundToPlay = settings.soundEffects.high;
        } else if (generatedScore >= 75 && settings.soundEffects.medium) {
          soundToPlay = settings.soundEffects.medium;
        } else if (generatedScore >= 60 && settings.soundEffects?.low) {
          soundToPlay = settings.soundEffects.low;
        }
        
        if (soundToPlay) {
          try {
            const soundUrl = await getSoundUrl(soundToPlay);
            const audio = new Audio(soundUrl);
            await audio.play();
          } catch (error) {
            console.error("Erro ao tocar áudio da pontuação:", error);
          }
        }
        
        // Sempre salvar no ranking
        await addToRanking({
          song: song!,
          singer: singerName,
          score: generatedScore
        });
        
        // Voltar para a página inicial após 6 segundos
        setTimeout(() => {
          navigate('/');
        }, 6000);
      }, 8000);
    } catch {}
  };

  return (
    <>
    <div className="min-h-screen bg-black flex flex-col">
      {/* Vídeo ou Simulação de vídeo */}
      {!showScore && !isAnimatingScore ? (
        <div ref={containerRef as any} className="relative flex-1 flex items-stretch justify-center bg-karaoke-dark">
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                autoPlay
                className="absolute inset-0 h-full w-full object-fill"
                onPlay={handleVideoStart}
                onEnded={() => {
                  setAllowPause(true);
                  handleSongEnd();
                }}
                onPause={() => {
                  // Evita pausa por clique acidental ou tecla espaço
                  const video = videoRef.current;
                  if (!video) return;
                  if (allowPause) return;
                  if (video.ended) return;
                  // Retomar imediatamente
                  video.play().catch(() => {});
                }}
              />
              {/* QR Code sobreposto no topo esquerdo */}
              <div className="absolute top-16 left-4 z-20 bg-white p-2 rounded shadow">
                <QRCodeSVG value={`${window.location.origin}/add`} size={96} includeMargin />
              </div>
              {/* Botão de Interrupção */}
              <Button
                onClick={handleStopPerformance}
                className="absolute top-4 left-4 z-30 bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 h-8"
                size="sm"
              >
                End
              </Button>
              {/* Botão flutuante para adicionar músicas durante a reprodução */}
              <Button
                onClick={() => setShowSearchPanel(!showSearchPanel)}
                className="absolute top-4 right-4 z-20 bg-karaoke-primary hover:bg-karaoke-secondary text-white"
                size="sm"
              >
                {showSearchPanel ? 'Fechar busca' : 'Adicionar música'}
              </Button>
              {/* Painel de busca/adição simplificado */}
              {showSearchPanel && (
                <div className="absolute top-14 right-4 z-20 w-96 max-h-[70vh] overflow-y-auto bg-white/95 rounded-md shadow-lg p-3 border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800">Adicionar à Fila</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSearchPanel(false)}
                      className="p-1 h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Campo de busca */}
                  <div className="relative mb-3">
                    <Input
                      placeholder="Buscar música..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      className="pr-8"
                      autoFocus
                    />
                    {isSearching && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-karaoke-primary border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Resultados da busca */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.map((song) => (
                        <div key={song.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="bg-karaoke-primary text-white text-xs px-2 py-1 rounded">
                                {song.number}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{song.title}</p>
                                <p className="text-xs text-gray-600 truncate">{song.artist}</p>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddToQueue(song)}
                            className="p-1 h-8 w-8 text-karaoke-primary hover:bg-karaoke-primary hover:text-white"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {searchTerm && searchResults.length === 0 && !isSearching && (
                    <p className="text-center text-gray-500 text-sm py-4">
                      Nenhuma música encontrada
                    </p>
                  )}
                </div>
              )}

              {/* Caixa simples para informar o cantor - agora dentro do contêiner do vídeo */}
              {showSingerInput && selectedSong && (
                <div className="absolute top-4 right-4 z-[9999]">
                  <div className="bg-white rounded-lg p-6 w-96 max-w-sm shadow-2xl border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Adicionar à Fila</h3>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Música selecionada:</p>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="font-medium">{selectedSong.title}</p>
                        <p className="text-sm text-gray-500">{selectedSong.artist}</p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quem vai cantar?
                      </label>
                      <Input
                        placeholder="Nome do cantor"
                        value={singerName}
                        onChange={(e) => setSingerName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSingerInput(false);
                          setSelectedSong(null);
                          setSingerName('');
                        }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleConfirmAddToQueue}
                        disabled={!singerName.trim()}
                        className="flex-1 bg-karaoke-primary hover:bg-karaoke-secondary"
                      >
                        OK
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-white text-2xl">
              {song ? (
                <div className="animate-pulse">
                  Reproduzindo: {song.title} - {song.artist}
                </div>
              ) : (
                <div>Carregando vídeo...</div>
              )}
            </div>
          )}
          
          {/* Container para a fila */}
          <div className="absolute top-4 right-4 w-64">
            {/* Fila de Espera - Limitada a 5 músicas */}
            <SongQueue queue={queue.slice(0, 5)} compact hidePlayButton />
          </div>
        </div>
      ) : (
        <div 
          className="score-background"
          style={settings?.backgroundImage ? { 
            backgroundImage: `url(${settings.backgroundImage})`
          } : {
            backgroundImage: 'linear-gradient(135deg, rgba(155, 135, 245, 0.2) 0%, rgba(30, 174, 219, 0.2) 100%)'
          }}
        >
          <div className="text-center">
            {isAnimatingScore ? (
              <div className="text-9xl font-bold text-white animate-pulse">
                {displayedScore}
              </div>
            ) : (
              <>
                {isPerformanceIncomplete ? (
                  <div className="space-y-6">
                    <div className="text-3xl font-bold text-white">
                      Ops! Performance muito curta
                    </div>
                    <div className="text-xl text-gray-600 text-center">
                      O nossos algorítimos não foram capazes de avaliar a sua pesformance.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-9xl font-bold animate-score-reveal text-white">
                      {displayedScore}
                    </div>
                    <div className="mt-8 text-2xl font-semibold text-white">
                      {score >= 90 
                        ? "🎉 Incrível! Você arrasou! 🎉" 
                        : score >= 75 
                          ? "�� Ótima performance! 🎵" 
                          : "👏 Boa tentativa! 👏"
                      }
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default PlaySong;
