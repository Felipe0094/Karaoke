import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import path from 'path';

// Configuração
const SUPABASE_URL = 'https://mjaxvbvgkgnfsmlghdke.supabase.co';
// ATENÇÃO: Para escrita em massa, idealmente usaríamos a SERVICE_ROLE_KEY se o RLS bloquear,
// mas como configuramos RLS permissivo para INSERT autenticado (ou publico temporariamente), a anon key pode funcionar se o usuário estiver logado ou se a política permitir.
// SE FALHAR: Você precisará pegar a SERVICE_ROLE_KEY no dashboard do Supabase (Settings > API).
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYXh2YnZna2duZnNtbGdoZGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczOTYxNTcsImV4cCI6MjA2Mjk3MjE1N30.dhHwe070VW90tFRJwroB2Dl45b3MGo7XbaBT84GepAw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvFilePath = path.join(__dirname, 'public', 'lista_de_musicas.csv');

async function importSongs() {
  console.log('Iniciando importação...');
  const songs = [];

  // Ler CSV
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      // Remover BOM (Byte Order Mark) da chave 'number' se existir
      // Isso acontece frequentemente em CSVs salvos como UTF-8 com BOM
      const numberKey = Object.keys(row).find(key => key.includes('number'));
      const number = numberKey ? row[numberKey] : null;

      if (number) {
        songs.push({
          number: number,
          title: row.title,
          artist: row.artist,
          lyrics: row.lyrics || null
        });
      }
    })
    .on('end', async () => {
      console.log(`Lido ${songs.length} músicas do CSV.`);
      
      // Inserir em lotes (chunks) de 100 para não estourar limite de request
      const chunkSize = 100;
      for (let i = 0; i < songs.length; i += chunkSize) {
        const chunk = songs.slice(i, i + chunkSize);
        
        const { error } = await supabase
          .from('songs')
          .upsert(chunk, { onConflict: 'number', ignoreDuplicates: true }); // Upsert baseado no numero

        if (error) {
          console.error(`Erro no lote ${i} - ${i + chunkSize}:`, error.message);
        } else {
          console.log(`Importado ${i + chunk.length} de ${songs.length}...`);
        }
      }
      console.log('Importação concluída!');
    });
}

importSongs();
