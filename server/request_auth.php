<?php

require_once __DIR__ . '/session_store.php';

function jsonResponseAndExit($statusCode, $payload)
{
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($payload);
    global $conn;
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
    exit;
}

function getAllowedCorsOrigins()
{
    $raw = getenv('CORS_ALLOWED_ORIGINS');
    if ($raw === false || trim($raw) === '') {
        return [
            'https://library.cvsu.dev',
            'http://library.cvsu.dev',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];
    }

    $parts = array_filter(array_map('trim', explode(',', $raw)));
    return array_values(array_unique($parts));
}

function applyCorsPolicy($methods = 'GET, POST, PUT, DELETE, OPTIONS', $headers = 'Content-Type, Authorization, X-Session-Id')
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = getAllowedCorsOrigins();

    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: ' . $methods);
    header('Access-Control-Allow-Headers: ' . $headers);
}

function handleCorsPreflightAndExitIfNeeded($methods = 'GET, POST, PUT, DELETE, OPTIONS', $headers = 'Content-Type, Authorization, X-Session-Id')
{
    applyCorsPolicy($methods, $headers);

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'OPTIONS') {
        return;
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && !in_array($origin, getAllowedCorsOrigins(), true)) {
        jsonResponseAndExit(403, ['success' => false, 'message' => 'Origin is not allowed.']);
    }

    jsonResponseAndExit(200, ['success' => true]);
}

function getAuthorizationBearerToken()
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($header) || stripos($header, 'Bearer ') !== 0) {
        return '';
    }

    return trim(substr($header, 7));
}

function getActorSessionId($requestData = [])
{
    $requestData = is_array($requestData) ? $requestData : [];

    $candidates = [
        $requestData['requester_session_id'] ?? null,
        $requestData['session_id'] ?? null,
        $_GET['requester_session_id'] ?? null,
        $_GET['session_id'] ?? null,
        $_SERVER['HTTP_X_SESSION_ID'] ?? null,
        getAuthorizationBearerToken()
    ];

    foreach ($candidates as $candidate) {
        $value = trim((string)($candidate ?? ''));
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function resolveAuthenticatedActor($requestData = [])
{
    $sessionId = getActorSessionId($requestData);
    if ($sessionId === '') {
        return null;
    }

    $session = findSessionById($sessionId);
    if (!$session || !empty($session['revoked_at'])) {
        return null;
    }

    return $session;
}

function requireAuthenticatedActor($requestData = [])
{
    $actor = resolveAuthenticatedActor($requestData);
    if (!$actor) {
        jsonResponseAndExit(401, ['success' => false, 'message' => 'Authentication required.']);
    }

    return $actor;
}

function requireAdminActor($requestData = [])
{
    $actor = requireAuthenticatedActor($requestData);
    if (($actor['role'] ?? '') !== 'admin') {
        jsonResponseAndExit(403, ['success' => false, 'message' => 'Admin access required.']);
    }

    return $actor;
}

// Backwards-compatible wrappers for older call sites
function requireAuth($requestData = [])
{
    return requireAuthenticatedActor($requestData);
}

function requireAdmin($requestData = [])
{
    return requireAdminActor($requestData);
}
