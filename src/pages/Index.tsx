import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SongSearch from '@/components/SongSearch';
import SongQueue from '@/components/SongQueue';
import Ranking from '@/components/Ranking';
import AddToQueueModal from '@/components/AddToQueueModal';
import Header from '@/components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { Song, QueueItem, RankingItem } from '@/types/song';
import { getQueue, getRanking, getSettings, AppSettings } from '@/services/dataService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Index = () => {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showAddToQueueModal, setShowAddToQueueModal] = useState(false);
  const [showSingerInputModal, setShowSingerInputModal] = useState(false);
  const [singerName, setSingerName] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Carrega dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const queueData = await getQueue();
        const rankingData = await getRanking();
        const settingsData = await getSettings();
        
        setQueue(queueData);
        setRanking(rankingData);
        setSettings(settingsData);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    };
    
    loadInitialData();
  }, []);

  // WebGL shader background setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;
      const int POINTS = 16;
      const float WAVE_OFFSET = 12000.0;
      const float SPEED = 1.0 / 12.0;
      const float COLOR_SPEED = 1.0 / 4.0;
      uniform float BRIGHTNESS;

      void voronoi(vec2 uv, inout vec3 col) {
          vec3 vor = vec3(0.0);
          float time = (iTime + WAVE_OFFSET) * SPEED;
          float bestDistance = 999.0;
          float lastBestDistance = bestDistance;
          for (int i = 0; i < POINTS; i++) {
              float fi = float(i);
              vec2 p = vec2(mod(fi, 1.0) * 0.1 + sin(fi), -0.05 + 0.15 * float(i / 10) + cos(fi + time * cos(uv.x * 0.025)));
              p.x += 0.01 * sin(iMouse.x / iResolution.x * 3.14);
              p.y += 0.01 * cos(iMouse.y / iResolution.y * 3.14);
              float d = distance(uv, p);
              if (d < bestDistance) {
                  lastBestDistance = bestDistance;
                  bestDistance = d;
                  vor.x = p.x;
                  vor.yz = vec2(p.x * 0.4 + p.y, p.y) * vec2(0.9, 0.87);
              }
          }
          col *= 0.68 + 0.19 * vor;
          col += smoothstep(0.99, 1.05, 1.0 - abs(bestDistance - lastBestDistance)) * 0.9;
          col += smoothstep(0.95, 1.01, 1.0 - abs(bestDistance - lastBestDistance)) * 0.1 * col;
          col += (vor) * 0.1 * smoothstep(0.5, 1.0, 1.0 - abs(bestDistance - lastBestDistance));
      }

      void main() {
          vec2 uv = gl_FragCoord.xy/iResolution.xy;
          vec3 col = 0.5 + 0.5*cos(iTime*COLOR_SPEED+uv.xyx+vec3(0.0,2.0,4.0));
          voronoi(uv * 4.0 - 1.0, col);
          gl_FragColor = vec4(col, 1.0) * BRIGHTNESS;
      }
    `;

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionAttribLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'iResolution');
    const timeUniformLocation = gl.getUniformLocation(program, 'iTime');
    const mouseUniformLocation = gl.getUniformLocation(program, 'iMouse');
    const brightnessUniformLocation = gl.getUniformLocation(program, 'BRIGHTNESS');

    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);

    let startTime = Date.now();
    let mouseX = 0;
    let mouseY = 0;
    let rafId = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    resizeCanvas();

    const render = () => {
      rafId = window.requestAnimationFrame(render);
      const elapsedTime = (Date.now() - startTime) / 1000;
      gl.useProgram(program);
      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      gl.uniform1f(timeUniformLocation, elapsedTime);
      gl.uniform2f(mouseUniformLocation, mouseX, mouseY);
      gl.uniform1f(brightnessUniformLocation, 0.8);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    render();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Atualiza a fila e o ranking a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const queueData = await getQueue();
        const rankingData = await getRanking();
        const settingsData = await getSettings();
        
        setQueue(queueData);
        setRanking(rankingData);
        setSettings(settingsData);
      } catch (error) {
        console.error('Erro ao atualizar dados:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSongSelect = (song: Song) => {
    setSelectedSong(song);
  };

  const handleStartSong = () => {
    if (selectedSong) {
      setShowSingerInputModal(true);
    }
  };

  const handleConfirmStartSong = () => {
    if (selectedSong && singerName.trim()) {
      // Salvar o nome do cantor no localStorage para usar na página de reprodução
      localStorage.setItem('currentSinger', singerName.trim());
      setShowSingerInputModal(false);
      setSingerName('');
      navigate(`/play/${selectedSong.number}`);
    }
  };

  const handleAddToQueue = () => {
    setShowAddToQueueModal(true);
  };

  const handleQueueSuccess = async () => {
    setShowAddToQueueModal(false);
    const updatedQueue = await getQueue();
    setQueue(updatedQueue);
  };

  return (
    <div 
      className="karaoke-container h-screen flex flex-col overflow-hidden relative" 
      style={settings?.backgroundImage ? { backgroundImage: `url(${settings.backgroundImage})` } : {}}
    >
      {/* Animated shader background */}
      <canvas ref={canvasRef} className="shader-canvas" />
      <Header />
      
      <main className="flex-1 container mx-auto p-4 flex flex-col items-center overflow-hidden relative z-10">
        <div className="w-full max-w-5xl h-full flex flex-col">
          <div className="mb-6">
            <SongSearch onSongSelect={handleSongSelect} />
            <div className="mt-4 self-start md:fixed md:top-4 md:left-4 md:z-50">
              <div className="bg-white p-2 rounded shadow">
                <QRCodeSVG value={`${window.location.origin}/add`} size={96} includeMargin />
              </div>
            </div>
            
            {selectedSong && (
              <div className="flex justify-center mt-6 gap-4">
                <Button 
                  className="bg-karaoke-primary hover:bg-karaoke-secondary" 
                  onClick={handleStartSong}
                >
                  Iniciar Música
                </Button>
                <Button 
                  variant="outline" 
                  className="border-karaoke-primary text-karaoke-primary hover:bg-karaoke-light" 
                  onClick={handleAddToQueue}
                >
                  Adicionar à Fila
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min">
            <Ranking ranking={ranking.slice(0, 5)} />
            <SongQueue queue={queue.slice(0, 5)} />
          </div>
        </div>
      </main>
      
      <AddToQueueModal 
        song={selectedSong} 
        isOpen={showAddToQueueModal}
        onClose={() => setShowAddToQueueModal(false)}
        onSuccess={handleQueueSuccess}
      />

      {/* Modal para informar o cantor ao iniciar música diretamente */}
      <Dialog open={showSingerInputModal} onOpenChange={setShowSingerInputModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quem vai cantar?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSong && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-medium">{selectedSong.title}</p>
                <p className="text-sm text-gray-500">{selectedSong.artist}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="singer-name">Nome do cantor</Label>
              <Input
                id="singer-name"
                placeholder="Digite o nome do cantor"
                value={singerName}
                onChange={(e) => setSingerName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && singerName.trim()) {
                    handleConfirmStartSong();
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSingerInputModal(false);
                  setSingerName('');
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmStartSong}
                disabled={!singerName.trim()}
                className="flex-1 bg-karaoke-primary hover:bg-karaoke-secondary"
              >
                Iniciar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
