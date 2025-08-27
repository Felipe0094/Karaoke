// Script para testar configurações de fundo
import fs from 'fs';

const testBackgroundSettings = () => {
  console.log('=== Teste de Configurações de Fundo ===\n');
  
  try {
    // Verificar se o localStorage está sendo usado (simulado)
    const localStoragePath = './src/services/dataService.ts';
    const dataServiceContent = fs.readFileSync(localStoragePath, 'utf8');
    
    console.log('✅ Arquivo dataService.ts encontrado');
    
    // Verificar se a função getSettings existe
    if (dataServiceContent.includes('getSettings')) {
      console.log('✅ Função getSettings encontrada');
    } else {
      console.log('❌ Função getSettings não encontrada');
    }
    
    // Verificar se o tipo AppSettings inclui backgroundImage
    if (dataServiceContent.includes('backgroundImage')) {
      console.log('✅ Propriedade backgroundImage encontrada');
    } else {
      console.log('❌ Propriedade backgroundImage não encontrada');
    }
    
    console.log('\n=== Como testar ===');
    console.log('1. Acesse a aba "Administração" → "Configurações"');
    console.log('2. Faça upload de uma imagem de fundo');
    console.log('3. Salve as configurações');
    console.log('4. Teste uma música e veja se o fundo aparece na tela de pontuação');
    console.log('5. Verifique se o fundo é o mesmo da tela inicial');
    
  } catch (error) {
    console.error('❌ Erro ao verificar configurações:', error.message);
  }
};

testBackgroundSettings();
