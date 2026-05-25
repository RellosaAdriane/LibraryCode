-- Database Schema for Library Management System
-- Run this in phpMyAdmin or import this file

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') DEFAULT 'student',
    birthday DATE,
    gender VARCHAR(10),
    affiliation ENUM('student', 'staff') DEFAULT 'student',
    institution_id VARCHAR(20) NULL,
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
    google_sub VARCHAR(191) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_institution_id (institution_id),
    UNIQUE INDEX uq_google_sub (google_sub)
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(100) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    category VARCHAR(50),
    copies_total INT DEFAULT 1,
    copies_available INT DEFAULT 1,
    qr_image_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title),
    INDEX idx_author (author)
);

-- Borrow Transactions table
CREATE TABLE IF NOT EXISTS borrow_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    action ENUM('BORROW', 'RETURN') NOT NULL,
    borrowed_at DATETIME NULL,
    due_at DATETIME NULL,
    returned_at DATETIME NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'OVERDUE') DEFAULT 'ACTIVE',
    grace_days INT NOT NULL DEFAULT 7,
    daily_fee DECIMAL(10,2) NOT NULL DEFAULT 150.00,
    overdue_days INT NOT NULL DEFAULT 0,
    penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_book_id (book_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_user_action_status_created (user_id, action, status, created_at),
    INDEX idx_user_book_action_status (user_id, book_id, action, status)
);

-- SSO settings table
CREATE TABLE IF NOT EXISTS sso_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    provider_name VARCHAR(120) NOT NULL DEFAULT 'SSO / LDAP',
    allowed_domains TEXT NOT NULL,
    admin_only TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO sso_settings (id, enabled, provider_name, allowed_domains, admin_only)
VALUES (1, 0, 'SSO / LDAP', '["cvsu.edu.ph"]', 0);

-- Admin 2FA settings table
CREATE TABLE IF NOT EXISTS admin_2fa_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO admin_2fa_settings (id, enabled) VALUES (1, 0);

-- Admin 2FA challenges table
CREATE TABLE IF NOT EXISTS admin_2fa_challenges (
    id CHAR(32) NOT NULL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_expires (expires_at)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(100) NOT NULL,
    role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    created_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    ip VARCHAR(45) NOT NULL,
    user_agent VARCHAR(300) NOT NULL,
    revoked_at DATETIME NULL,
    revoked_reason VARCHAR(120) NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_last_seen (last_seen_at),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Security audit logs table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_time DATETIME NULL,
    event_ts BIGINT NULL,
    event_key VARCHAR(120) NOT NULL,
    email_hash VARCHAR(255) NULL,
    ip VARCHAR(45) NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_ts (event_ts),
    INDEX idx_email_hash (email_hash),
    INDEX idx_event_ts_id (event_ts, id)
);

-- Student activities table
CREATE TABLE IF NOT EXISTS student_activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    action VARCHAR(120) NOT NULL,
    details TEXT NULL,
    event_time DATETIME NULL,
    event_ts BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_event_ts (event_ts),
    INDEX idx_event_ts_id (event_ts, id)
);

-- Insert sample data
INSERT INTO users (first_name, last_name, email, password, role) VALUES
('John', 'Doe', 'john.doe@example.com', '$2y$10$abcdefghijklmnopqrstuv', 'student'),
('Jane', 'Smith', 'jane.smith@example.com', '$2y$10$abcdefghijklmnopqrstuv', 'student');

INSERT INTO books (title, author, isbn, category, copies_total, copies_available) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', '978-0743273565', 'Fiction', 5, 5),
('To Kill a Mockingbird', 'Harper Lee', '978-0061120084', 'Fiction', 3, 3),
('1984', 'George Orwell', '978-0451524935', 'Fiction', 4, 4),
('Pride and Prejudice', 'Jane Austen', '978-0141439518', 'Fiction', 3, 3),
('The Catcher in the Rye', 'J.D. Salinger', '978-0316769488', 'Fiction', 2, 2),
('Introduction to Algorithms', 'Thomas H. Cormen', '978-0262033848', 'Computer Science', 5, 3),
('Clean Code', 'Robert C. Martin', '978-0132350884', 'Computer Science', 4, 4),
('Design Patterns', 'Erich Gamma', '978-0201633610', 'Computer Science', 3, 3);

-- Sample borrow transactions
INSERT INTO borrow_transactions (user_id, book_id, action, borrowed_at, due_at, returned_at, status, created_at) VALUES
(1, 6, 'BORROW', '2024-01-10 10:00:00', '2024-01-24 10:00:00', NULL, 'ACTIVE', '2024-01-10 10:00:00'),
(1, 7, 'BORROW', '2024-01-05 10:00:00', '2024-01-19 10:00:00', '2024-01-18 10:00:00', 'COMPLETED', '2024-01-05 10:00:00'),
(1, 8, 'BORROW', '2024-01-15 10:00:00', '2024-01-29 10:00:00', NULL, 'OVERDUE', '2024-01-15 10:00:00');
