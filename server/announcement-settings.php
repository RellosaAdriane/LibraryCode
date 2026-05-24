<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/request_auth.php';
requireAdmin();
require_once __DIR__ . '/announcement_settings_store.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit;
}

if ($method === 'GET') {
    echo json_encode([
        "success" => true,
        "settings" => readAnnouncementSettings()
    ]);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $settings = writeAnnouncementSettings([
        'enabled' => (bool)($data['enabled'] ?? false),
        'title' => trim((string)($data['title'] ?? 'Library Notice')),
        'message' => trim((string)($data['message'] ?? ''))
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Announcement settings updated.",
        "settings" => $settings
    ]);
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method"]);