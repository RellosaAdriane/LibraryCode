<?php

require_once __DIR__ . '/db.php';

function normalizeSessionAgent($userAgent)
{
    $userAgent = trim((string)$userAgent);
    if ($userAgent === '') {
        return 'Unknown';
    }
    return substr($userAgent, 0, 280);
}

function createSession($user, $ip, $userAgent)
{
    $sessionId = 'sess_' . bin2hex(random_bytes(16));
    $now = gmdate('Y-m-d H:i:s');

    $session = [
        'id' => $sessionId,
        'user_id' => (int)($user['id'] ?? 0),
        'email' => (string)($user['email'] ?? ''),
        'role' => (string)($user['role'] ?? 'student'),
        'created_at' => $now,
        'last_seen_at' => $now,
        'ip' => (string)$ip,
        'user_agent' => normalizeSessionAgent($userAgent),
        'revoked_at' => null,
        'revoked_reason' => null
    ];

    global $conn;
    $stmt = $conn->prepare("INSERT INTO sessions (id, user_id, email, role, created_at, last_seen_at, ip, user_agent, revoked_at, revoked_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)");
    if ($stmt) {
        $stmt->bind_param(
            'sissssss',
            $session['id'],
            $session['user_id'],
            $session['email'],
            $session['role'],
            $session['created_at'],
            $session['last_seen_at'],
            $session['ip'],
            $session['user_agent']
        );
        $stmt->execute();
        $stmt->close();
    }

    return $session;
}

function findSessionById($sessionId)
{
    global $conn;
    $stmt = $conn->prepare("SELECT id, user_id, email, role, created_at, last_seen_at, ip, user_agent, revoked_at, revoked_reason
        FROM sessions WHERE id = ? LIMIT 1");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function touchSession($sessionId)
{
    global $conn;
    $stmt = $conn->prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL");
    if ($stmt) {
        $now = gmdate('Y-m-d H:i:s');
        $stmt->bind_param('ss', $now, $sessionId);
        $stmt->execute();
        $stmt->close();
    }

    return findSessionById($sessionId);
}

function revokeSession($sessionId, $reason = '')
{
    global $conn;
    $stmt = $conn->prepare("UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ?");
    if ($stmt) {
        $now = gmdate('Y-m-d H:i:s');
        $stmt->bind_param('sss', $now, $reason, $sessionId);
        $stmt->execute();
        $stmt->close();
    }

    return findSessionById($sessionId);
}

function listSessions($userId = null, $includeRevoked = true)
{
    global $conn;
    $query = "SELECT id, user_id, email, role, created_at, last_seen_at, ip, user_agent, revoked_at, revoked_reason FROM sessions";
    $clauses = [];
    $params = [];
    $types = '';

    if ($userId !== null) {
        $clauses[] = 'user_id = ?';
        $params[] = (int)$userId;
        $types .= 'i';
    }
    if (!$includeRevoked) {
        $clauses[] = 'revoked_at IS NULL';
    }

    if (!empty($clauses)) {
        $query .= ' WHERE ' . implode(' AND ', $clauses);
    }
    $query .= ' ORDER BY last_seen_at DESC';

    $stmt = $conn->prepare($query);
    if (!$stmt) {
        return [];
    }

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $sessions = [];
    while ($row = $result->fetch_assoc()) {
        $sessions[] = $row;
    }
    $stmt->close();

    return $sessions;
}
