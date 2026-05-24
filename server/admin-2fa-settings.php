<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/request_auth.php';
requireAdmin();
require_once __DIR__ . '/admin_2fa_store.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit;
}

if ($method === 'GET') {
    echo json_encode([
        "success" => true,
        "settings" => readAdmin2faSettings()
    ]);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $settings = writeAdmin2faSettings([
        'enabled' => (bool)($data['enabled'] ?? false)
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Admin 2FA settings updated.",
        "settings" => $settings
    ]);
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method"]);
