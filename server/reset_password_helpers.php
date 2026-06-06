<?php

require_once __DIR__ . '/otp_store.php';
require_once __DIR__ . '/datetime_utils.php';

const RESET_OTP_TTL_SECONDS = 300;
const RESET_OTP_MAX_ATTEMPTS = 5;
const RESET_OTP_RESEND_COOLDOWN_SECONDS = 60;
const RESET_RATE_WINDOW_SECONDS = 900;
const RESET_RATE_LIMIT_PER_EMAIL = 5;
const RESET_RATE_LIMIT_PER_IP = 15;
const RESET_RATE_STORE_FILE = __DIR__ . '/tmp/reset_rate_store.json';
const RESET_AUDIT_LOG_FILE = __DIR__ . '/tmp/reset_password_audit.log';

function findResetRecordKey(array $records, string $emailKey)
{
    $needle = strtolower(trim($emailKey));
    foreach ($records as $k => $v) {
        if (strtolower(trim((string)$k)) === $needle) {
            return $k;
        }
    }
    return null;
}

function ensureResetRateStoreDirectory()
{
    $dir = dirname(RESET_RATE_STORE_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function defaultResetStore()
{
    return [
        'records' => [],
        'rate' => [
            'emails' => [],
            'ips' => []
        ]
    ];
}

function readResetRateStore()
{
    ensureResetRateStoreDirectory();

    $paths = [RESET_RATE_STORE_FILE, __DIR__ . '/tmp/reset_otp_store.json'];
    foreach ($paths as $path) {
        if (!file_exists($path)) {
            continue;
        }

        $raw = file_get_contents($path);
        if ($raw === false || trim($raw) === '') {
            continue;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            continue;
        }

        if (!isset($decoded['records']) || !is_array($decoded['records'])) {
            $records = $decoded;
            unset($records['rate']);
            $decoded = defaultResetStore();
            $decoded['records'] = $records;
        }

        if (!isset($decoded['rate']) || !is_array($decoded['rate'])) {
            $decoded['rate'] = [];
        }
        if (!isset($decoded['rate']['emails']) || !is_array($decoded['rate']['emails'])) {
            $decoded['rate']['emails'] = [];
        }
        if (!isset($decoded['rate']['ips']) || !is_array($decoded['rate']['ips'])) {
            $decoded['rate']['ips'] = [];
        }

        return $decoded;
    }

    return defaultResetStore();
}

function writeResetRateStore($store)
{
    ensureResetRateStoreDirectory();
    file_put_contents(RESET_RATE_STORE_FILE, json_encode($store, JSON_PRETTY_PRINT), LOCK_EX);
}

function resetOtpExpiresAtUnix($record)
{
    $expiresAt = $record['expires_at'] ?? 0;
    if (is_numeric($expiresAt)) {
        return (int)$expiresAt;
    }

    $parsed = strtotime((string)$expiresAt);
    return $parsed !== false ? $parsed : 0;
}

function resetOtpLastSentAt($email, array $records, $emailKey)
{
    $lastSent = 0;
    $otpRecord = otp_get_record('reset', $email);
    if (is_array($otpRecord)) {
        $lastSent = (int)($otpRecord['last_sent_at'] ?? 0);
    }

    $foundRec = findResetRecordKey($records, $emailKey);
    if ($foundRec !== null) {
        $lastSent = max($lastSent, (int)($records[$foundRec]['last_sent_at'] ?? 0));
    }

    return $lastSent;
}

function getClientIp()
{
    $candidates = [
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
        $_SERVER['HTTP_CLIENT_IP'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? ''
    ];

    foreach ($candidates as $candidate) {
        if ($candidate === '') continue;
        $parts = explode(',', $candidate);
        $ip = trim($parts[0]);
        if ($ip !== '') {
            return $ip;
        }
    }
    return 'unknown';
}

function maskEmail($email)
{
    $parts = explode('@', $email);
    if (count($parts) !== 2) {
        return '***';
    }

    $name = $parts[0];
    $domain = $parts[1];
    $maskedName = strlen($name) <= 2
        ? substr($name, 0, 1) . '*'
        : substr($name, 0, 1) . str_repeat('*', max(1, strlen($name) - 2)) . substr($name, -1);

    return $maskedName . '@' . $domain;
}

function appendResetAuditLog($event, $email, $ip, $details = [])
{
    ensureResetRateStoreDirectory();
    $entry = [
        'time' => libraryIsoTimestamp(),
        'event' => $event,
        'email_hash' => hash('sha256', strtolower($email)),
        'ip' => $ip,
        'details' => $details
    ];
    file_put_contents(RESET_AUDIT_LOG_FILE, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function pruneRateWindow($items, $now)
{
    return array_values(array_filter($items, function ($ts) use ($now) {
        return ($now - (int)$ts) <= RESET_RATE_WINDOW_SECONDS;
    }));
}

function passwordStrengthScore($password)
{
    $score = 0;
    if (strlen($password) >= 8) $score++;
    if (preg_match('/[A-Z]/', $password)) $score++;
    if (preg_match('/[a-z]/', $password)) $score++;
    if (preg_match('/\d/', $password)) $score++;
    if (preg_match('/[^A-Za-z0-9]/', $password)) $score++;
    return $score;
}

function inspectResetOtpRecord($email, $otp, $now)
{
    if ($otp === '' || !preg_match('/^\d{6}$/', $otp)) {
        return [
            'success' => false,
            'message' => 'Enter a valid 6-digit verification code.',
            'invalid_code' => true
        ];
    }

    $record = otp_get_record('reset', $email);
    if (!is_array($record)) {
        return [
            'success' => false,
            'message' => 'Invalid or expired code. Request a new one.',
            'not_found' => true
        ];
    }

    if (resetOtpExpiresAtUnix($record) < $now) {
        otp_delete_record('reset', $email);
        return [
            'success' => false,
            'message' => 'Code expired. Request a new one.',
            'expired' => true
        ];
    }

    $attempts = (int)($record['attempts'] ?? 0);
    if ($attempts >= RESET_OTP_MAX_ATTEMPTS) {
        otp_delete_record('reset', $email);
        return [
            'success' => false,
            'message' => 'Too many invalid attempts. Request a new code.',
            'locked' => true
        ];
    }

    if (!password_verify($otp, $record['otp_hash'] ?? '')) {
        return [
            'success' => false,
            'message' => 'The verification code is incorrect. Please check the code and try again.',
            'invalid_code' => true,
            'attempts' => $attempts
        ];
    }

    return [
        'success' => true,
        'record' => $record
    ];
}
