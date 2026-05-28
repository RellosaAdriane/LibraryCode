<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();

// Centralized DB configuration. Loads environment from /env if present.
$envPath = __DIR__ . '/../env';
if (is_readable($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines !== false) {
        foreach ($lines as $line) {
            $trim = trim($line);
            if ($trim === '' || strpos($trim, '#') === 0) continue;
            if (strpos($trim, '=') === false) continue;
            list($k, $v) = explode('=', $trim, 2);
            $k = trim($k); $v = trim($v);
            if ($v !== '' && $v[0] === '"' && substr($v, -1) === '"') {
                $v = substr($v, 1, -1);
            }
            if ($k !== '' && getenv($k) === false) {
                putenv("{$k}={$v}");
                $_ENV[$k] = $v;
            }
        }
    }
}

$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = (int)(getenv('DB_PORT') ?: 3306);
$DB_NAME = getenv('DB_NAME') ?: 'library_db';
$DB_USER = getenv('DB_USER') ?: getenv('DB_USERNAME') ?: 'library';
$DB_PASS = getenv('DB_PASS') ?: getenv('DB_PASSWORD') ?: null;

// Helper: build mysqli connection using the central config
function db_connect()
{
    global $DB_HOST, $DB_USER, $DB_PASS, $DB_PORT, $DB_NAME;
    $conn = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, null, $DB_PORT);
    if ($conn->connect_error) {
        return null;
    }
    $conn->set_charset('utf8mb4');
    // Ensure database exists and select it
    $conn->query("CREATE DATABASE IF NOT EXISTS {$DB_NAME}");
    $conn->select_db($DB_NAME);
    initLibraryDatabaseTimezone($conn);
    return $conn;
}

?>
