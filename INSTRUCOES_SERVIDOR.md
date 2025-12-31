# Instruções de Configuração do Karaoke

## Opção 1: Usar Servidor Local (Recomendado)

### Vantagens:
- ✅ Melhor performance e streaming de vídeo
- ✅ Suporte a diferentes formatos de vídeo
- ✅ Controle de acesso e segurança
- ✅ Funciona com qualquer navegador

### Como usar:

1. **Configure o caminho dos vídeos:**
   - Acesse a aba "Administração" → "Configurações"
   - Em "Modo de Acesso aos Arquivos", selecione "Usar Servidor Local"
   - Em "Caminho dos Arquivos MP4", digite: `D:\KARAOKEV3\musicas`
   - Configure os caminhos dos arquivos de áudio (sons de pontuação, tambores, etc.)
   - Clique em "Salvar Alterações"

2. **Inicie o servidor:**
   - **Opção A:** Execute o arquivo `start-server.bat` (duplo clique)
   - **Opção B:** No terminal, execute: `node server.js`
   - **Opção C:** No PowerShell, execute: `node server.js`

3. **Verifique se o servidor está rodando:**
   - Abra o navegador e acesse: `http://localhost:3001/test`
   - Deve aparecer: `{"message":"Servidor funcionando!"}`

4. **Use o sistema normalmente:**
   - O sistema agora acessará os vídeos através do servidor

---

## Opção 2: Acessar Arquivos Diretamente

### Vantagens:
- ✅ Não precisa iniciar servidor
- ✅ Configuração mais simples

### Desvantagens:
- ❌ Pode ter limitações de segurança do navegador
- ❌ Não funciona em todos os navegadores
- ❌ Sem streaming otimizado

### Como usar:

1. **Configure o caminho dos vídeos:**
   - Acesse a aba "Administração" → "Configurações"
   - Em "Modo de Acesso aos Arquivos", selecione "Acessar Arquivos Diretamente"
   - Em "Caminho dos Arquivos MP4", digite: `D:\KARAOKEV3\musicas`
   - Configure os caminhos dos arquivos de áudio (sons de pontuação, tambores, etc.)
   - Clique em "Salvar Alterações"

2. **Use o sistema normalmente:**
   - O sistema tentará acessar os arquivos diretamente

---

## Solução de Problemas

### Erro "ERR_CONNECTION_REFUSED"
- **Causa:** O servidor não está rodando
- **Solução:** Inicie o servidor com `node server.js`

### Vídeo não carrega
- **Causa:** Caminho incorreto ou arquivo não existe
- **Solução:** 
  1. Verifique se o caminho está correto nas configurações
  2. Verifique se o arquivo existe: `D:\KARAOKEV3\musicas\03045.mp4`
  3. Use barras normais (/) em vez de barras invertidas (\)

### Servidor não inicia
- **Causa:** Node.js não instalado ou porta em uso
- **Solução:**
  1. Instale o Node.js: https://nodejs.org/
  2. Verifique se a porta 3001 não está sendo usada por outro programa
  3. Tente usar a porta 3002 editando o arquivo `server.js`

---

## Estrutura de Arquivos Esperada

```
D:\KARAOKEV3\
├── musicas\
│   ├── 03045.mp4
│   ├── 03046.mp4
│   └── ...
└── audio\
    ├── acima de 90.mp3
    ├── 75 a 90.mp3
    ├── abaixo de 75.mp3
    ├── tambores.mp3
    └── sem_performance.mp3
```

### Tipos de Arquivos de Áudio:
- **acima de 90.mp3**: Som para pontuação alta (91-100)
- **75 a 90.mp3**: Som para pontuação média (75-90)
- **abaixo de 75.mp3**: Som para pontuação baixa (60-75)
- **tambores.mp3**: Som de tambores durante a animação de pontuação
- **sem_performance.mp3**: Som para performance incompleta (< 60 segundos)

---

## Comandos Úteis

```bash
# Iniciar servidor
node server.js

# Verificar se o servidor está rodando
curl http://localhost:3001/test

# Parar servidor (Ctrl+C)
```

---

## Configuração Avançada

### Mudar porta do servidor:
Edite o arquivo `server.js` e altere a linha:
```javascript
const port = 3001; // Mude para a porta desejada
```

### Configurar variáveis de ambiente:
```bash
# Windows
set VIDEOS_PATH=D:\KARAOKEV3\musicas
set SOUNDS_PATH=D:\KARAOKEV3\audio
node server.js

# Linux/Mac
export VIDEOS_PATH=/path/to/videos
export SOUNDS_PATH=/path/to/sounds
node server.js
```
