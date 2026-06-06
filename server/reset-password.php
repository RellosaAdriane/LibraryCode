<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/otp_store.php';

const RESET_OTP_TTL_SECONDS = 300;
const RESET_OTP_MAX_ATTEMPTS = 5;
const RESET_OTP_RESEND_COOLDOWN_SECONDS = 60;
const RESET_RATE_WINDOW_SECONDS = 900;
const RESET_RATE_LIMIT_PER_EMAIL = 5;
const RESET_RATE_LIMIT_PER_IP = 15;
const RESET_RATE_STORE_FILE = __DIR__ . '/tmp/reset_rate_store.json';
const RESET_AUDIT_LOG_FILE = __DIR__ . '/tmp/reset_password_audit.log';

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

        // Legacy combined file: only migrate rate/cooldown metadata, not OTP hashes.
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

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    $data = [];
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["success" => false, "message" => "Invalid request method"]);
    $conn->close();
    exit;
}

$action = trim(strtolower($data['action'] ?? 'send_otp'));
$email = trim($data['email'] ?? '');
$otp = trim((string)($data['otp'] ?? ''));
$newPassword = $data['new_password'] ?? '';
$ip = getClientIp();
$now = libraryUnixTime();

if ($email === '') {
    echo json_encode(["success" => false, "message" => "Email is required"]);
    $conn->close();
    exit;
}

$allowedDomains = ["cvsu.edu.ph", "gmail.com", "yahoo.com"];
$parts = explode("@", $email);
if (count($parts) !== 2 || !in_array(strtolower($parts[1]), $allowedDomains)) {
    echo json_encode(["success" => false, "message" => "Email must be cvsu.edu.ph, gmail.com or yahoo.com"]);
    $conn->close();
    exit;
}

$emailKey = strtolower($email);
$maskedEmail = maskEmail($email);
$store = readResetRateStore();
$records = $store['records'];
$rate = $store['rate'];

// Helper: find record key tolerant to casing/whitespace
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

$emailHits = pruneRateWindow($rate['emails'][$emailKey] ?? [], $now);
$ipHits = pruneRateWindow($rate['ips'][$ip] ?? [], $now);

if ($action === 'send_otp') {
    if (count($emailHits) >= RESET_RATE_LIMIT_PER_EMAIL || count($ipHits) >= RESET_RATE_LIMIT_PER_IP) {
        appendResetAuditLog('rate_limited', $email, $ip, ['action' => 'send_otp']);
        echo json_encode([
            "success" => false,
            "message" => "Too many requests. Please try again later.",
            "cooldown_seconds" => RESET_OTP_RESEND_COOLDOWN_SECONDS
        ]);
        $conn->close();
        exit;
    }

    $lastSent = resetOtpLastSentAt($email, $records, $emailKey);
    if ($lastSent > 0) {
        $remaining = RESET_OTP_RESEND_COOLDOWN_SECONDS - ($now - $lastSent);
        if ($remaining > 0) {
            appendResetAuditLog('send_blocked_cooldown', $email, $ip, ['remaining' => $remaining]);
            echo json_encode([
                "success" => false,
                "message" => "Please wait before requesting another code.",
                "cooldown_seconds" => $remaining,
                "masked_email" => $maskedEmail
            ]);
            $conn->close();
            exit;
        }
    }

    $stmt = $conn->prepare("SELECT first_name FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $userExists = $result->num_rows > 0;
    $user = $userExists ? $result->fetch_assoc() : ['first_name' => 'Student'];
    $stmt->close();

    $rate['emails'][$emailKey] = [...$emailHits, $now];
    $rate['ips'][$ip] = [...$ipHits, $now];

    if ($userExists) {
        $otpCode = (string) random_int(100000, 999999);
        // Store in DB or file via helper
        otp_set_record('reset', $email, password_hash($otpCode, PASSWORD_DEFAULT), $now + RESET_OTP_TTL_SECONDS, 0, $now);

        $mailResult = sendPasswordResetOtpEmail($email, $user['first_name'] ?? 'Student', $otpCode);
        if (!$mailResult['success']) {
            otp_delete_record('reset', $email);
            $store['rate'] = $rate;
            writeResetRateStore($store);
            appendResetAuditLog('mail_send_failed', $email, $ip, ['error' => $mailResult['message']]);
            echo json_encode(["success" => false, "message" => "Unable to send code right now. Please try again."]);
            $conn->close();
            exit;
        }
        appendResetAuditLog('otp_sent', $email, $ip, []);
    } else {
        // create a placeholder zeroed record in store for cooldown/tracking
        $records[$emailKey] = [
            'otp_hash' => '',
            'expires_at' => $now,
            'attempts' => 0,
            'last_sent_at' => $now
        ];
        appendResetAuditLog('otp_requested_for_unknown_email', $email, $ip, []);
    }

    $store['records'] = $records;
    $store['rate'] = $rate;
    writeResetRateStore($store);

    echo json_encode([
        "success" => true,
        "message" => "If this email exists in our system, we sent a verification code.",
        "cooldown_seconds" => RESET_OTP_RESEND_COOLDOWN_SECONDS,
        "masked_email" => $maskedEmail
    ]);
    $conn->close();
    exit;
}

if ($action === 'check_otp') {
    $otpCheck = inspectResetOtpRecord($email, $otp, $now);
    if (!$otpCheck['success']) {
        if (!empty($otpCheck['invalid_code']) && isset($otpCheck['attempts'])) {
            otp_increment_attempts('reset', $email);
            appendResetAuditLog('check_invalid_otp', $email, $ip, ['attempts' => ($otpCheck['attempts'] ?? 0) + 1]);
        } elseif (!empty($otpCheck['expired'])) {
            $store['records'] = $records;
            writeResetRateStore($store);
            appendResetAuditLog('check_expired', $email, $ip, []);
        } elseif (!empty($otpCheck['locked'])) {
            $store['records'] = $records;
            writeResetRateStore($store);
            appendResetAuditLog('check_locked', $email, $ip, []);
        } elseif (!empty($otpCheck['not_found'])) {
            appendResetAuditLog('check_no_record', $email, $ip, []);
        }

        echo json_encode(['success' => false, 'message' => $otpCheck['message']]);
        $conn->close();
        exit;
    }

    appendResetAuditLog('check_otp_success', $email, $ip, []);
    echo json_encode([
        'success' => true,
        'message' => 'Code verified. Create your new password.'
    ]);
    $conn->close();
    exit;
}

if ($action === 'verify_otp') {
    if ($newPassword === '' || strlen($newPassword) < 8 || strlen($newPassword) > 16 || preg_match('/\s/', $newPassword)) {
        echo json_encode(["success" => false, "message" => "Password must be 8 to 16 characters without spaces."]);
        $conn->close();
        exit;
    }

    if (passwordStrengthScore($newPassword) <= 2) {
        echo json_encode([
            "success" => false,
            "message" => "Weak password detected. Please use a medium or strong password."
        ]);
        $conn->close();
        exit;
    }

    $otpCheck = inspectResetOtpRecord($email, $otp, $now);
    if (!$otpCheck['success']) {
        if (!empty($otpCheck['invalid_code']) && isset($otpCheck['attempts'])) {
            otp_increment_attempts('reset', $email);
            appendResetAuditLog('verify_invalid_otp', $email, $ip, ['attempts' => ($otpCheck['attempts'] ?? 0) + 1]);
        } elseif (!empty($otpCheck['expired'])) {
            $store['records'] = $records;
            writeResetRateStore($store);
            appendResetAuditLog('verify_expired', $email, $ip, []);
        } elseif (!empty($otpCheck['locked'])) {
            $store['records'] = $records;
            writeResetRateStore($store);
            appendResetAuditLog('verify_locked', $email, $ip, []);
        } elseif (!empty($otpCheck['not_found'])) {
            appendResetAuditLog('verify_no_record', $email, $ip, []);
            error_log('reset-password.php: no reset record for ' . $email);
        }

        echo json_encode(["success" => false, "message" => $otpCheck['message']]);
        $conn->close();
        exit;
    }

    $currentStmt = $conn->prepare("SELECT password FROM users WHERE email = ?");
    $currentStmt->bind_param("s", $email);
    $currentStmt->execute();
    $currentResult = $currentStmt->get_result();
    $currentUser = $currentResult->num_rows > 0 ? $currentResult->fetch_assoc() : null;
    $currentStmt->close();

    if (!$currentUser) {
        appendResetAuditLog('password_reset_user_missing', $email, $ip, []);
        echo json_encode(["success" => false, "message" => "Unable to reset password. Please request a new code."]);
        $conn->close();
        exit;
    }

    if (password_verify($newPassword, $currentUser['password'] ?? '')) {
        appendResetAuditLog('password_reset_reused_password', $email, $ip, []);
        echo json_encode([
            "success" => false,
            "message" => "For security, do not reuse your old password. Please create a new one."
        ]);
        $conn->close();
        exit;
    }

    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateStmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
    $updateStmt->bind_param("ss", $hashedPassword, $email);
    $ok = $updateStmt->execute();
    $affected = $updateStmt->affected_rows;
    $updateStmt->close();

    if (!$ok || $affected < 0) {
        appendResetAuditLog('password_reset_failed', $email, $ip, []);
        echo json_encode(["success" => false, "message" => "Failed to reset password. Please try again."]);
        $conn->close();
        exit;
    }

    // Invalidate OTP and rate state for this email.
    otp_delete_record('reset', $email);
    $foundRec = findResetRecordKey($records, $emailKey);
    if ($foundRec !== null) {
        unset($records[$foundRec]);
    }
    unset($rate['emails'][$emailKey]);
    $store['records'] = $records;
    $store['rate'] = $rate;
    writeResetRateStore($store);
    appendResetAuditLog('password_reset_success', $email, $ip, []);

    echo json_encode([
        "success" => true,
        "message" => "Password reset successful. Please log in with your new password.",
        "session_revoke_recommended" => true
    ]);
    $conn->close();
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid action"]);
$conn->close();
?>
