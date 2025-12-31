-- Add new columns for sound effects
ALTER TABLE settings
ADD COLUMN drums_sound TEXT,
ADD COLUMN incomplete_sound TEXT; 