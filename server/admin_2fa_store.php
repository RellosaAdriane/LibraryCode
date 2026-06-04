<?php

require_once __DIR__ . '/db.php';
const ADMIN_2FA_OTP_TTL_SECONDS = 300;
const ADMIN_2FA_OTP_MAX_ATTEMPTS = 5;

function getDefaultAdmin2faSettings()
{
    return [
        'enabled' => false
    ];
}

function readAdmin2faSettings()
{
    global $conn;
    $result = $conn->query("SELECT enabled FROM admin_2fa_settings WHERE id = 1 LIMIT 1");
    if (!$result) {
        return getDefaultAdmin2faSettings();
    }

    $row = $result->fetch_assoc();
    if (!$row) {
        return getDefaultAdmin2faSettings();
    }

    return [
        'enabled' => (bool)($row['enabled'] ?? false)
    ];
}

function writeAdmin2faSettings($settings)
{
    $nextSettings = array_merge(getDefaultAdmin2faSettings(), $settings);
    $enabled = $nextSettings['enabled'] ? 1 : 0;

    global $conn;
    $stmt = $conn->prepare("INSERT INTO admin_2fa_settings (id, enabled)
        VALUES (1, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = CURRENT_TIMESTAMP");
    if ($stmt) {
        $stmt->bind_param('i', $enabled);
        $stmt->execute();
        $stmt->close();
    }

    return $nextSettings;
}

function isAdmin2faEnabled()
{
    $settings = readAdmin2faSettings();
    return (bool)($settings['enabled'] ?? false);
}

function createAdmin2faChallenge($email)
{
    $emailKey = strtolower(trim((string)$email));
    if ($emailKey === '') {
        return [
            'success' => false,
            'message' => 'Email is required for 2FA.'
        ];
    }

    global $conn;
    $conn->query("DELETE FROM admin_2fa_challenges WHERE expires_at < NOW()");

    $otpCode = (string)random_int(100000, 999999);
    $challengeId = bin2hex(random_bytes(16));
    $otpHash = password_hash($otpCode, PASSWORD_DEFAULT);
    $expiresAt = libraryNow()->modify('+' . ADMIN_2FA_OTP_TTL_SECONDS . ' seconds')->format('Y-m-d H:i:s');

    $stmt = $conn->prepare("INSERT INTO admin_2fa_challenges (id, email, otp_hash, expires_at, attempts)
        VALUES (?, ?, ?, ?, 0)");
    if ($stmt) {
        $stmt->bind_param('ssss', $challengeId, $emailKey, $otpHash, $expiresAt);
        $stmt->execute();
        $stmt->close();
    }

    return [
        'success' => true,
        'challenge_id' => $challengeId,
        'otp_code' => $otpCode
    ];
}

function verifyAdmin2faChallenge($challengeId, $email, $otp)
{
    $challengeId = trim((string)$challengeId);
    $emailKey = strtolower(trim((string)$email));
    $otp = trim((string)$otp);

    if ($challengeId === '' || $emailKey === '') {
        return [
            'success' => false,
            'message' => '2FA challenge is missing.'
        ];
    }

    global $conn;
    $stmt = $conn->prepare("SELECT email, otp_hash, expires_at, attempts FROM admin_2fa_challenges WHERE id = ? LIMIT 1");
    if (!$stmt) {
        return [
            'success' => false,
            'message' => '2FA challenge not found. Please request a new code.'
        ];
    }
    $stmt->bind_param('s', $challengeId);
    $stmt->execute();
    $result = $stmt->get_result();
    $entry = $result->fetch_assoc();
    $stmt->close();

    if (!$entry) {
        return [
            'success' => false,
            'message' => '2FA challenge not found. Please request a new code.'
        ];
    }

    $expiresAt = strtotime($entry['expires_at'] ?? '') ?: 0;
    if ($expiresAt < libraryUnixTime()) {
        $deleteStmt = $conn->prepare("DELETE FROM admin_2fa_challenges WHERE id = ?");
        if ($deleteStmt) {
            $deleteStmt->bind_param('s', $challengeId);
            $deleteStmt->execute();
            $deleteStmt->close();
        }
        return [
            'success' => false,
            'message' => '2FA code has expired. Please request a new code.'
        ];
    }

    if (($entry['email'] ?? '') !== $emailKey) {
        return [
            'success' => false,
            'message' => '2FA challenge does not match this account.'
        ];
    }

    $attempts = (int)($entry['attempts'] ?? 0);
    if ($attempts >= ADMIN_2FA_OTP_MAX_ATTEMPTS) {
        $deleteStmt = $conn->prepare("DELETE FROM admin_2fa_challenges WHERE id = ?");
        if ($deleteStmt) {
            $deleteStmt->bind_param('s', $challengeId);
            $deleteStmt->execute();
            $deleteStmt->close();
        }
        return [
            'success' => false,
            'message' => 'Too many invalid attempts. Please request a new code.'
        ];
    }

    if (!preg_match('/^\d{6}$/', $otp)) {
        return [
            'success' => false,
            'message' => 'Enter a valid 6-digit code.'
        ];
    }

    if (!password_verify($otp, $entry['otp_hash'] ?? '')) {
        $updateStmt = $conn->prepare("UPDATE admin_2fa_challenges SET attempts = attempts + 1 WHERE id = ?");
        if ($updateStmt) {
            $updateStmt->bind_param('s', $challengeId);
            $updateStmt->execute();
            $updateStmt->close();
        }
        return [
            'success' => false,
            'message' => 'Invalid 2FA code.'
        ];
    }

    $deleteStmt = $conn->prepare("DELETE FROM admin_2fa_challenges WHERE id = ?");
    if ($deleteStmt) {
        $deleteStmt->bind_param('s', $challengeId);
        $deleteStmt->execute();
        $deleteStmt->close();
    }

    return [
        'success' => true
    ];
}

function removeAdmin2faChallenge($challengeId)
{
    $challengeId = trim((string)$challengeId);
    if ($challengeId === '') {
        return false;
    }

    global $conn;
    $stmt = $conn->prepare("DELETE FROM admin_2fa_challenges WHERE id = ?");
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('s', $challengeId);
    $stmt->execute();
    $affected = $stmt->affected_rows > 0;
    $stmt->close();
    return $affected;
}
