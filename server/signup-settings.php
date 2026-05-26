<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/signup_settings_store.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit;
}

if ($method === 'GET') {
    echo json_encode([
        "success" => true,
        "settings" => readSignupSettings()
    ]);
    exit;
}

if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents("php://input"), true);
    $settings = writeSignupSettings([
        'email_verification_enabled' => (bool)($data['email_verification_enabled'] ?? true)
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Signup settings updated.",
        "settings" => $settings
    ]);
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method"]);
