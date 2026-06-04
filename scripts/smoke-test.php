#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * End-to-end smoke test for library API endpoints.
 * Usage: php scripts/smoke-test.php [base_url]
 */

$baseUrl = rtrim($argv[1] ?? getenv('SMOKE_BASE_URL') ?: 'https://library.cvsu.dev', '/');
$root = dirname(__DIR__);

require_once $root . '/server/db.php';
require_once $root . '/server/session_store.php';

$results = [];
$passed = 0;
$failed = 0;
$skipped = 0;

function smokeResult(array &$results, string $name, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    $results[] = [
        'name' => $name,
        'ok' => $ok,
        'detail' => $detail,
    ];
    if ($ok) {
        $passed++;
        echo "PASS  {$name}\n";
        return;
    }
    $failed++;
    echo "FAIL  {$name}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
}

function smokeSkip(array &$results, string $name, string $detail = ''): void
{
    global $skipped;
    $skipped++;
    $results[] = [
        'name' => $name,
        'ok' => null,
        'detail' => $detail,
    ];
    echo "SKIP  {$name}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
}

function fetchUserByRole(mysqli $conn, string $role): ?array
{
    $stmt = $conn->prepare('SELECT id, first_name, last_name, email, role FROM users WHERE role = ? ORDER BY id ASC LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $role);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function httpRequest(string $baseUrl, string $path, array $options = []): array
{
    $url = $baseUrl . $path;
    $method = strtoupper($options['method'] ?? 'GET');
    $headers = $options['headers'] ?? [];
    $body = $options['body'] ?? null;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => true,
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $responseBody = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => is_string($responseBody) ? $responseBody : '',
        'error' => $error,
    ];
}

function jsonOk(array $response, callable $assert): bool
{
    if ($response['error'] !== '') {
        return false;
    }
    $decoded = json_decode($response['body'], true);
    if (!is_array($decoded)) {
        return false;
    }
    return (bool)$assert($decoded, $response);
}

function sessionHeaders(string $sessionId, array $extra = []): array
{
    return array_merge([
        'Accept: application/json',
        'Content-Type: application/json',
        'X-Session-Id: ' . $sessionId,
        'Authorization: Bearer ' . $sessionId,
    ], $extra);
}

echo "Library smoke test\n";
echo "Base URL: {$baseUrl}\n\n";

// --- Public endpoints ---
$publicGets = [
    'health.php' => static fn(array $json) => ($json['status'] ?? '') === 'ok',
    'phil_time.php' => static fn(array $json) => !empty($json['timestamp']) || !empty($json['time']),
    'books.php' => static fn(array $json) => !empty($json['success']) && is_array($json['books'] ?? null),
    'signup-settings.php' => static fn(array $json) => array_key_exists('success', $json),
    'penalty-settings.php' => static fn(array $json) => array_key_exists('success', $json),
    'announcement-settings.php' => static fn(array $json) => array_key_exists('success', $json),
    'google-config.php' => static fn(array $json) => array_key_exists('success', $json),
    'sso-settings.php' => static fn(array $json) => array_key_exists('success', $json),
    'api/student/sync-state.php' => static fn(array $json) => !empty($json['success']) && !empty($json['revision']),
];

foreach ($publicGets as $path => $assert) {
    $response = httpRequest($baseUrl, '/' . $path);
    $ok = $response['status'] === 200 && jsonOk($response, static function (array $json) use ($assert, $response) {
        return $assert($json);
    });
    smokeResult(
        $results,
        "GET /{$path}",
        $ok,
        $ok ? '' : "status={$response['status']} body=" . substr($response['body'], 0, 120)
    );
}

// --- Auth-protected endpoints ---
$adminUser = fetchUserByRole($conn, 'admin');
$studentUser = fetchUserByRole($conn, 'student');

if (!$adminUser || !$studentUser) {
    smokeSkip($results, 'auth sessions', 'Missing admin or student user in database');
} else {
    $adminSession = createSession($adminUser, '127.0.0.1', 'smoke-test-admin');
    $studentSession = createSession($studentUser, '127.0.0.1', 'smoke-test-student');

    $adminId = (int)$adminUser['id'];
    $adminEmail = (string)$adminUser['email'];
    $studentId = (int)$studentUser['id'];
    $studentEmail = (string)$studentUser['email'];

    $adminQuery = http_build_query([
        'requester_session_id' => $adminSession['id'],
        'requester_id' => $adminId,
        'requester_email' => $adminEmail,
    ]);
    $studentQuery = http_build_query([
        'requester_session_id' => $studentSession['id'],
        'requester_id' => $studentId,
        'requester_email' => $studentEmail,
    ]);

    $adminGets = [
        "api/admin/sync-state.php?{$adminQuery}" => static fn(array $json) => !empty($json['revision']),
        "api/admin/borrow-records.php?{$adminQuery}&limit=5" => static fn(array $json) => !empty($json['success']),
        "api/admin/recent-circulation.php?{$adminQuery}&limit=5" => static fn(array $json) => !empty($json['success']) && is_array($json['activities'] ?? null),
        "api/admin/user-borrows.php?{$adminQuery}&user_id={$studentId}" => static fn(array $json) => !empty($json['success']),
        "users.php?{$adminQuery}" => static fn(array $json) => !empty($json['success']) && is_array($json['users'] ?? null),
        "sessions.php?{$adminQuery}&include_revoked=1" => static fn(array $json) => !empty($json['success']) && is_array($json['sessions'] ?? null),
        "security-logs.php?{$adminQuery}" => static fn(array $json) => !empty($json['success']),
        "student-activity.php?{$adminQuery}" => static fn(array $json) => !empty($json['success']),
        "admin-2fa-settings.php?{$adminQuery}" => static fn(array $json) => array_key_exists('success', $json),
    ];

    foreach ($adminGets as $path => $assert) {
        $response = httpRequest($baseUrl, '/' . $path, [
            'headers' => sessionHeaders($adminSession['id']),
        ]);
        $ok = $response['status'] === 200 && jsonOk($response, static function (array $json) use ($assert) {
            return $assert($json);
        });
        smokeResult(
            $results,
            "GET /{$path}",
            $ok,
            $ok ? '' : "status={$response['status']} body=" . substr($response['body'], 0, 120)
        );
    }

    $studentGets = [
        "api/student/sync-state.php" => static fn(array $json) => !empty($json['revision']),
        "api/student/summary.php" => static fn(array $json) => !empty($json['success']),
        "api/student/borrowed.php" => static fn(array $json) => !empty($json['success']),
        "api/student/returned.php" => static fn(array $json) => !empty($json['success']),
        "api/student/activities.php" => static fn(array $json) => !empty($json['success']),
        "api/student/collection.php" => static fn(array $json) => !empty($json['success']),
    ];

    foreach ($studentGets as $path => $assert) {
        $response = httpRequest($baseUrl, '/' . $path, [
            'headers' => sessionHeaders($studentSession['id']),
        ]);
        $ok = $response['status'] === 200 && jsonOk($response, static function (array $json) use ($assert) {
            return $assert($json);
        });
        smokeResult(
            $results,
            "GET /{$path} (student)",
            $ok,
            $ok ? '' : "status={$response['status']} body=" . substr($response['body'], 0, 120)
        );
    }

    // Session validation + touch
    $validateResponse = httpRequest(
        $baseUrl,
        '/sessions.php?' . http_build_query([
            'session_id' => $studentSession['id'],
            'requester_session_id' => $studentSession['id'],
            'requester_id' => $studentId,
            'requester_email' => $studentEmail,
        ]),
        ['headers' => sessionHeaders($studentSession['id'])]
    );
    smokeResult(
        $results,
        'GET /sessions.php validate (student)',
        $validateResponse['status'] === 200 && jsonOk($validateResponse, static fn(array $json) => !empty($json['active'])),
        $validateResponse['status'] !== 200 ? 'status=' . $validateResponse['status'] : ''
    );

    $touchResponse = httpRequest($baseUrl, '/sessions.php', [
        'method' => 'PUT',
        'headers' => sessionHeaders($studentSession['id']),
        'body' => json_encode([
            'action' => 'touch',
            'session_id' => $studentSession['id'],
            'requester_session_id' => $studentSession['id'],
        ]),
    ]);
    smokeResult(
        $results,
        'PUT /sessions.php touch (student)',
        $touchResponse['status'] === 200 && jsonOk($touchResponse, static fn(array $json) => !empty($json['success'])),
        $touchResponse['status'] !== 200 ? 'status=' . $touchResponse['status'] : ''
    );

    // Sync revision should change after a no-op is impossible; verify endpoint is stable
    $sync1 = httpRequest($baseUrl, '/api/admin/sync-state.php?' . $adminQuery, [
        'headers' => sessionHeaders($adminSession['id']),
    ]);
    $sync2 = httpRequest($baseUrl, '/api/admin/sync-state.php?' . $adminQuery, [
        'headers' => sessionHeaders($adminSession['id']),
    ]);
    $rev1 = json_decode($sync1['body'], true)['revision'] ?? '';
    $rev2 = json_decode($sync2['body'], true)['revision'] ?? '';
    smokeResult(
        $results,
        'Admin sync revision stable between polls',
        $rev1 !== '' && $rev1 === $rev2,
        "rev1={$rev1} rev2={$rev2}"
    );

    // Cleanup smoke sessions
    revokeSession($adminSession['id'], 'smoke-test cleanup');
    revokeSession($studentSession['id'], 'smoke-test cleanup');
}

// --- Frontend build artifacts ---
$buildChecks = [
    $root . '/build/index.html',
    $root . '/build/assets/index-CXtyh6rN.js',
    $root . '/build/assets/Dashboard-BJ4T-s1q.js',
    $root . '/build/assets/StudentDashboard-B-XGuk8H.js',
    $root . '/build/assets/useSyncPolling-BvRbGsbN.js',
    $root . '/build/assets/libraryDataEvents-2TuPWBV_.js',
];

foreach ($buildChecks as $file) {
    $name = str_replace($root . '/', '', $file);
    if (!is_file($file)) {
        // Hashed asset names change each build; check by glob for some
        if (str_contains($name, 'build/assets/') && str_contains($name, '-')) {
            smokeSkip($results, "file {$name}", 'Hashed bundle name may differ after rebuild');
            continue;
        }
    }
    smokeResult($results, "file {$name}", is_file($file));
}

if (is_dir($root . '/build/assets')) {
    $hasSyncPolling = count(glob($root . '/build/assets/useSyncPolling-*.js')) > 0;
    $hasLibraryEvents = count(glob($root . '/build/assets/libraryDataEvents-*.js')) > 0;
    $hasDashboard = count(glob($root . '/build/assets/Dashboard-*.js')) > 0;
    smokeResult($results, 'build bundle useSyncPolling present', $hasSyncPolling);
    smokeResult($results, 'build bundle libraryDataEvents present', $hasLibraryEvents);
    smokeResult($results, 'build bundle Dashboard present', $hasDashboard);
}

$conn->close();

echo "\nSummary: {$passed} passed, {$failed} failed, {$skipped} skipped\n";
exit($failed > 0 ? 1 : 0);
