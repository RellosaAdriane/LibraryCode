<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/reset_password_helpers.php';

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

    if (!$ok || $affected <= 0) {
        appendResetAuditLog('password_reset_failed', $email, $ip, []);
        echo json_encode(["success" => false, "message" => "Failed to reset password. Please try again."]);
        $conn->close();
        exit;
    }

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
