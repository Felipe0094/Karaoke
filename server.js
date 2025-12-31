import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// Removido Supabase; configuração será feita via endpoint local

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001; // Porta diferente do frontend

// Habilitar CORS para o frontend acessar
app.use(cors());
app.use(express.json());

// Fila compartilhada em memória para múltiplos dispositivos
let sharedQueue = [];

// Configuração de diretórios controlada via endpoint
let videosPathOverride = process.env.VIDEOS_PATH || null;
let soundsPathOverride = process.env.SOUNDS_PATH || null;

// Função para obter o caminho dos vídeos das configurações
async function getVideosPath() {
    return videosPathOverride || 'D:/KARAOKEV3/musicas';
}

// Função para obter o caminho dos sons das configurações
async function getSoundsPath() {
    return soundsPathOverride || 'D:/KARAOKEV3/audio';
}

// Endpoints para configurar caminhos em tempo de execução
app.get('/config', async (req, res) => {
    res.json({
        videosPath: await getVideosPath(),
        soundsPath: await getSoundsPath(),
    });
});

app.post('/config', async (req, res) => {
    try {
        const { videosPath, soundsPath } = req.body || {};
        if (typeof videosPath === 'string' && videosPath.trim()) {
            videosPathOverride = videosPath.trim();
        }
        if (typeof soundsPath === 'string' && soundsPath.trim()) {
            soundsPathOverride = soundsPath.trim();
        }
        res.json({ ok: true, videosPath: await getVideosPath(), soundsPath: await getSoundsPath() });
    } catch (e) {
        res.status(400).json({ ok: false, error: 'Dados inválidos' });
    }
});

// Endpoints da fila compartilhada (cross-device)
app.get('/queue', (req, res) => {
    try {
        // Retorna cópia ordenada por posição de fila/created_at
        const sorted = [...sharedQueue]
            .sort((a, b) => {
                const ap = typeof a.queue_position === 'number' ? a.queue_position : Number.MAX_SAFE_INTEGER;
                const bp = typeof b.queue_position === 'number' ? b.queue_position : Number.MAX_SAFE_INTEGER;
                if (ap !== bp) return ap - bp;
                return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            })
            .map((item, index) => ({
                ...item,
                queue_position: index + 1,
            }));
        sharedQueue = sorted;
        res.json(sharedQueue);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao obter fila' });
    }
});

app.post('/queue', (req, res) => {
    try {
        const body = req.body || {};
        const song = body.song;
        const singer = String(body.singer || '').trim();
        if (!song || !singer) {
            return res.status(400).json({ error: 'Parâmetros inválidos' });
        }
        const id = 'q_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        const nextPos = (sharedQueue.reduce((max, i) => Math.max(max, i.queue_position || 0), 0) || 0) + 1;
        const item = {
            id,
            song,
            singer,
            queue_position: nextPos,
            created_at: new Date().toISOString(),
        };
        sharedQueue.push(item);
        res.status(201).json(item);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao adicionar à fila' });
    }
});

app.delete('/queue/:id', (req, res) => {
    try {
        const { id } = req.params;
        const idx = sharedQueue.findIndex(i => i.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Item não encontrado' });
        sharedQueue.splice(idx, 1);
        // Normaliza posições
        sharedQueue = sharedQueue.map((item, index) => ({ ...item, queue_position: index + 1 }));
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao remover da fila' });
    }
});

// Rota para servir os vídeos com suporte a streaming
app.get('/videos/:filename', async (req, res) => {
    const filename = req.params.filename;
    const videosPath = await getVideosPath();
    let videoPath = path.join(videosPath, filename);

    const allowedVideoExtensions = ['.mp4', '.mkv', '.mov', '.avi'];
    const videoMimeTypes = {
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
    };

    console.log('Requisição de vídeo recebida:');
    console.log('Nome do arquivo:', filename);
    console.log('Caminho do diretório de vídeos:', videosPath);
    console.log('Caminho completo do arquivo:', videoPath);

    // Verificar se o arquivo existe; se não, tentar localizar por prefixo do número
    if (!fs.existsSync(videoPath)) {
        console.log('Arquivo não encontrado (exato):', videoPath);
        try {
            const baseNumber = path.parse(filename).name; // ex.: "20001"
            const entries = fs.readdirSync(videosPath, { withFileTypes: true });
            const candidates = entries
                .filter(e => e.isFile())
                .map(e => e.name)
                .filter(name => {
                    const lower = name.toLowerCase();
                    const hasAllowedExt = allowedVideoExtensions.some(ext => lower.endsWith(ext));
                    return hasAllowedExt && name.startsWith(baseNumber);
                });
            if (candidates.length > 0) {
                videoPath = path.join(videosPath, candidates[0]);
                console.log('Arquivo alternativo encontrado por prefixo:', videoPath);
            } else {
                console.log('Nenhum arquivo .mp4 encontrado com prefixo:', baseNumber);
                return res.status(404).send('Arquivo de vídeo não encontrado');
            }
        } catch (e) {
            console.log('Erro ao procurar arquivo alternativo:', e);
            return res.status(404).send('Arquivo de vídeo não encontrado');
        }
    }

    // Obter o tamanho do arquivo
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Parsing do header range
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const ext = path.extname(videoPath).toLowerCase();
        const contentType = videoMimeTypes[ext] || 'video/mp4';
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const ext = path.extname(videoPath).toLowerCase();
        const contentType = videoMimeTypes[ext] || 'video/mp4';
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Endpoint de debug para resolver caminho de vídeo por número
app.get('/videos/resolve/:number', async (req, res) => {
    try {
        const videosPath = await getVideosPath();
        const number = req.params.number;
        const exact = path.join(videosPath, `${number}.mp4`);
        const existsExact = fs.existsSync(exact);
        const entries = fs.readdirSync(videosPath, { withFileTypes: true });
        const allowedVideoExtensions = ['.mp4', '.mkv', '.mov', '.avi'];
        const candidates = entries
            .filter(e => e.isFile())
            .map(e => e.name)
            .filter(name => {
                const lower = name.toLowerCase();
                const hasAllowedExt = allowedVideoExtensions.some(ext => lower.endsWith(ext));
                return hasAllowedExt && name.startsWith(number);
            });
        res.json({ videosPath, number, exact, existsExact, candidates, resolved: existsExact ? exact : (candidates[0] ? path.join(videosPath, candidates[0]) : null) });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

// Rota para servir os arquivos de som
app.get('/sounds/:filename', async (req, res) => {
    const filename = req.params.filename;
    const soundsPath = await getSoundsPath();
    const soundPath = path.join(soundsPath, filename);

    console.log('Requisição de som recebida:');
    console.log('Nome do arquivo:', filename);
    console.log('Caminho do diretório de sons:', soundsPath);
    console.log('Caminho completo do arquivo:', soundPath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(soundPath)) {
        console.log('Arquivo não encontrado:', soundPath);
        return res.status(404).send('Arquivo de som não encontrado');
    }

    console.log('Arquivo encontrado, verificando extensão...');

    // Verificar a extensão do arquivo
    const ext = path.extname(soundPath).toLowerCase();
    const allowedExtensions = ['.mp3', '.wav', '.ogg'];
    
    if (!allowedExtensions.includes(ext)) {
        console.log('Extensão não permitida:', ext);
        return res.status(400).send('Tipo de arquivo não permitido');
    }

    console.log('Extensão válida:', ext);

    // Configurar o tipo MIME correto
    const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg'
    };

    res.setHeader('Content-Type', mimeTypes[ext]);
    console.log('Iniciando stream do arquivo...');
    fs.createReadStream(soundPath).pipe(res);
});

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ message: 'Servidor funcionando!' });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
}); 