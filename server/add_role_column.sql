-- Add role column to users table
ALTER TABLE users ADD COLUMN role ENUM('student', 'admin') DEFAULT 'student';
ALTER TABLE users ADD COLUMN affiliation ENUM('student', 'staff') DEFAULT 'student';
ALTER TABLE users ADD COLUMN institution_id VARCHAR(20) NULL;

-- To update existing users to have 'student' role (if needed)
UPDATE users SET role = 'student' WHERE role IS NULL;
UPDATE users SET affiliation = 'student' WHERE affiliation IS NULL;

-- To create an admin user manually (example)
-- INSERT INTO users (first_name, last_name, email, password, role) 
-- VALUES ('Admin', 'User', 'admin@example.com', '$2y$10$...hashed_password...', 'admin');
