-- Remove faculty from affiliation enum
-- Run this in phpMyAdmin or your MySQL client
ALTER TABLE users
    MODIFY COLUMN affiliation ENUM('student', 'staff') DEFAULT 'student';

-- Optional: backfill any existing faculty values to student
UPDATE users SET affiliation = 'student' WHERE affiliation = 'faculty' OR affiliation IS NULL OR affiliation = '';
