<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/penalty_settings_store.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit;
}

if ($method === 'GET') {
    echo json_encode([
        "success" => true,
        "settings" => readPenaltySettings()
    ]);
    exit;
}

if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents("php://input"), true);
    $settings = writePenaltySettings([
        'grace_days' => $data['grace_days'] ?? 7,
        'daily_fee' => $data['daily_fee'] ?? 150,
        'block_overdue_days' => $data['block_overdue_days'] ?? 14
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Penalty settings updated.",
        "settings" => $settings
    ]);
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method"]);
