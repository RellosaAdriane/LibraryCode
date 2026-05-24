-- Add Google authentication columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(191) NULL;

-- Keep existing users on local auth unless they are linked later
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR auth_provider = '';