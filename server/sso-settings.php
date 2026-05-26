<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/sso_settings_store.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit;
}

if ($method === 'GET') {
    echo json_encode([
        "success" => true,
        "settings" => readSsoSettings()
    ]);
    exit;
}

if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents("php://input"), true);
    $allowedDomains = $data['allowed_domains'] ?? [];

    if (is_string($allowedDomains)) {
        $allowedDomains = array_filter(array_map('trim', explode(',', $allowedDomains)));
    }

    $settings = writeSsoSettings([
        'enabled' => (bool)($data['enabled'] ?? false),
        'provider_name' => trim((string)($data['provider_name'] ?? 'SSO / LDAP')),
        'allowed_domains' => is_array($allowedDomains) ? $allowedDomains : [],
        'admin_only' => (bool)($data['admin_only'] ?? false)
    ]);

    echo json_encode([
        "success" => true,
        "message" => "SSO settings updated.",
        "settings" => $settings
    ]);
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method"]);
