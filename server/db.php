<?php
// Database configuration
$host = getenv("DB_HOST") ?: "127.0.0.1";
$port = (int) (getenv("DB_PORT") ?: 3306);
$username = getenv("DB_USER") ?: "root";
$password = getenv("DB_PASS") !== false ? getenv("DB_PASS") : "";
$database = getenv("DB_NAME") ?: "library_db";

// Create connection
$conn = @new mysqli($host, $username, $password, null, $port);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . ". Check that MySQL is running in XAMPP and confirm host/port (current: {$host}:{$port}).");
}

// Set charset to UTF-8
$conn->set_charset("utf8mb4");

// For XAMPP, create database if not exists
$sql = "CREATE DATABASE IF NOT EXISTS $database";
if ($conn->query($sql) === TRUE) {
    // Select the database
    if (!$conn->select_db($database)) {
        die("Could not select database '{$database}': " . $conn->error);
    }
}

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
        $conn->query("ALTER TABLE users ADD COLUMN affiliation ENUM('student', 'faculty', 'staff') DEFAULT 'student'");
    }
    if (!isset($columns['institution_id'])) {
        $conn->query("ALTER TABLE users ADD COLUMN institution_id VARCHAR(20) NULL");
    }
}

ensureUsersTableColumns($conn);
?>
