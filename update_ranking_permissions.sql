
-- Habilitar RLS na tabela (caso não esteja)
ALTER TABLE ranking ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos (opcional, mas recomendado para limpeza)
DROP POLICY IF EXISTS "Enable read access for all users" ON ranking;
DROP POLICY IF EXISTS "Enable insert for all users" ON ranking;
DROP POLICY IF EXISTS "Enable delete for all users" ON ranking;
DROP POLICY IF EXISTS "Public Access" ON ranking;

-- Criar uma política unificada que permite TUDO (Select, Insert, Update, Delete) para todos (anon/public)
CREATE POLICY "Enable all operations for public users"
ON ranking
FOR ALL
TO public
USING (true)
WITH CHECK (true);
