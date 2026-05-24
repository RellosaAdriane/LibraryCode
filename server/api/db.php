<?php
require_once __DIR__ . '/../server/db_config.php';

$conn = db_connect();
if ($conn === null) {
    http_response_code(500);
    die(json_encode(["success" => false, "message" => "Database connection failed"]));
}

// Maintain compatibility: legacy API files expect UTF-8 and JSON
header("Content-Type: application/json");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>
