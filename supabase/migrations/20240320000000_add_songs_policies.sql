-- Enable RLS on songs table
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to songs
CREATE POLICY "Allow public read on songs"
ON songs
FOR SELECT
TO public
USING (true);
 