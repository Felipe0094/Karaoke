-- Setup songs table for TSV Import
-- Run this in Supabase SQL Editor to prepare the table.

-- 1. Drop existing table to ensure clean slate (Caution: deletes existing data)
DROP TABLE IF EXISTS public.songs;

-- 2. Create table with columns matching the TSV headers
-- We use 'uuid' with a default generator for 'id' so it doesn't need to be in the TSV.
CREATE TABLE public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    lyrics TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create an index on 'number' for faster lookups and uniqueness (optional but recommended)
CREATE UNIQUE INDEX songs_number_idx ON public.songs (number);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies
-- Allow anyone to READ songs
CREATE POLICY "Allow public read on songs" 
ON public.songs 
FOR SELECT 
TO public 
USING (true);

-- Allow authenticated users (or service role) to INSERT/UPDATE (needed for Import if you are logged in)
-- For simplicity in the dashboard, the dashboard user is admin, so it bypasses RLS, 
-- but explicit policies are good practice.
CREATE POLICY "Enable insert for authenticated users only" 
ON public.songs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" 
ON public.songs 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" 
ON public.songs 
FOR DELETE 
TO authenticated 
USING (true);
