-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public access for all operations on settings
CREATE POLICY "Allow public access to settings"
ON settings
FOR ALL
TO public
USING (true)
WITH CHECK (true); 