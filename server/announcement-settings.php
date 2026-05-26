<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, POST, OPTIONS');
header("Content-Type: application/json");
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
    requireAdmin();
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
