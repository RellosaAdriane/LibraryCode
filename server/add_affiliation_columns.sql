-- Add affiliation and institution_id columns to users table (safe migration)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS affiliation ENUM('student', 'staff') DEFAULT 'student',
    ADD COLUMN IF NOT EXISTS institution_id VARCHAR(20) NULL;

-- Backfill existing records
UPDATE users SET affiliation = 'student' WHERE affiliation IS NULL OR affiliation = '';
