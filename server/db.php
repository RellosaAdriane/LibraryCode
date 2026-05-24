<?php
require_once __DIR__ . '/db_config.php';

$conn = db_connect();
if ($conn === null) {
    die("Connection failed: cannot connect to database. Check DB settings.");
}

// Ensure users table columns and security tables are prepared by the rest of the file

function ensureUsersTableColumns($conn)
{
    $columns = [];
    $result = $conn->query("SHOW COLUMNS FROM users");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $columns[$row['Field']] = true;
        }
        $result->free();
    }

    if (!isset($columns['role'])) {
        $conn->query("ALTER TABLE users ADD COLUMN role ENUM('student', 'admin') DEFAULT 'student'");
    }
    if (!isset($columns['affiliation'])) {
        $conn->query("ALTER TABLE users ADD COLUMN affiliation ENUM('student', 'staff') DEFAULT 'student'");
    }
    if (!isset($columns['institution_id'])) {
        $conn->query("ALTER TABLE users ADD COLUMN institution_id VARCHAR(20) NULL");
    }
    if (!isset($columns['auth_provider'])) {
        $conn->query("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'");
    }
    if (!isset($columns['google_sub'])) {
        $conn->query("ALTER TABLE users ADD COLUMN google_sub VARCHAR(191) NULL");
    }
}

ensureUsersTableColumns($conn);

function ensureSecurityTables($conn)
{
    $conn->query("CREATE TABLE IF NOT EXISTS sso_settings (
        id TINYINT NOT NULL PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        provider_name VARCHAR(120) NOT NULL DEFAULT 'SSO / LDAP',
        allowed_domains TEXT NOT NULL,
        admin_only TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS admin_2fa_settings (
        id TINYINT NOT NULL PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS admin_2fa_challenges (
        id CHAR(32) NOT NULL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        email VARCHAR(100) NOT NULL,
        role ENUM('student','admin') NOT NULL DEFAULT 'student',
        created_at DATETIME NOT NULL,
        last_seen_at DATETIME NOT NULL,
        ip VARCHAR(45) NOT NULL,
        user_agent VARCHAR(300) NOT NULL,
        revoked_at DATETIME NULL,
        revoked_reason VARCHAR(120) NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_last_seen (last_seen_at),
        CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("INSERT IGNORE INTO sso_settings (id, enabled, provider_name, allowed_domains, admin_only)
        VALUES (1, 0, 'SSO / LDAP', '[\"cvsu.edu.ph\"]', 0)");
    $conn->query("INSERT IGNORE INTO admin_2fa_settings (id, enabled) VALUES (1, 0)");
}

ensureSecurityTables($conn);
?>
