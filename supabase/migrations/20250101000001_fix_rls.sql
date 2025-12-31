-- Fix RLS policy to allow data import
-- Run this in Supabase SQL Editor

-- Allow public insert access to songs (temporarily for seeding)
CREATE POLICY "Allow public insert on songs" 
ON public.songs 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow public update access (for upsert)
CREATE POLICY "Allow public update on songs" 
ON public.songs 
FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);
