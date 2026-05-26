<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
header('Content-Type: application/json');

function readEnvFileValue($key)
{
    $envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'env';
    if (!file_exists($envPath)) {
        return '';
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return '';
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$candidateKey, $candidateValue] = explode('=', $line, 2);
        if (trim($candidateKey) === $key) {
            return trim($candidateValue);
        }
    }

    return '';
}

function getGoogleClientId()
{
    $candidates = [
        getenv('GOOGLE_CLIENT_ID'),
        getenv('REACT_APP_GOOGLE_CLIENT_ID'),
        readEnvFileValue('GOOGLE_CLIENT_ID'),
        readEnvFileValue('REACT_APP_GOOGLE_CLIENT_ID')
    ];

    foreach ($candidates as $candidate) {
        $candidate = trim((string)$candidate);
        if ($candidate !== '') {
            return $candidate;
        }
    }

    return '';
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$clientId = getGoogleClientId();
echo json_encode([
    'success' => $clientId !== '',
    'client_id' => $clientId,
    'configured' => $clientId !== ''
]);
?>
