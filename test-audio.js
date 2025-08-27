// Script de teste para verificar acesso aos arquivos de áudio
import fs from 'fs';
import path from 'path';

const testAudioFiles = () => {
  console.log('=== Teste de Acesso aos Arquivos de Áudio ===\n');
  
  // Caminhos de teste
  const testPaths = [
    'D:/KARAOKEV3/audio/acima de 90.mp3',
    'D:/KARAOKEV3/audio/75 a 90.mp3',
    'D:/KARAOKEV3/audio/abaixo de 75.mp3',
    'D:/KARAOKEV3/audio/tambores.mp3',
    'D:/KARAOKEV3/audio/sem_performance.mp3'
  ];
  
  console.log('Verificando arquivos de áudio...\n');
  
  testPaths.forEach(audioPath => {
    try {
      const exists = fs.existsSync(audioPath);
      const status = exists ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO';
      console.log(`${status}: ${audioPath}`);
      
      if (exists) {
        const stats = fs.statSync(audioPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   Tamanho: ${sizeInMB} MB`);
      }
    } catch (error) {
      console.log(`❌ ERRO: ${audioPath}`);
      console.log(`   Erro: ${error.message}`);
    }
  });
  
  console.log('\n=== Teste de URLs ===\n');
  
  // Teste de URLs
  testPaths.forEach(audioPath => {
    const filename = path.basename(audioPath);
    const serverUrl = `http://localhost:3001/sounds/${filename}`;
    const directUrl = `file:///${audioPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    
    console.log(`Arquivo: ${filename}`);
    console.log(`  Servidor: ${serverUrl}`);
    console.log(`  Direto:   ${directUrl}`);
    console.log('');
  });
  
  console.log('=== Instruções ===\n');
  console.log('1. Para usar servidor: Configure "Usar Servidor Local" nas configurações');
  console.log('2. Para acesso direto: Configure "Acessar Arquivos Diretamente" nas configurações');
  console.log('3. Certifique-se de que os arquivos existem nos caminhos especificados');
  console.log('4. Use barras normais (/) em vez de barras invertidas (\\) nos caminhos');
};

testAudioFiles();
