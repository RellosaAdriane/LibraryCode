<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/admin_2fa_store.php';
require_once __DIR__ . '/session_store.php';

const LOGIN_SECURITY_STORE_FILE = __DIR__ . '/tmp/login_security_store.json';
const SECURITY_AUDIT_LOG_FILE = __DIR__ . '/tmp/security_audit.log';
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 600;
const LOGIN_RATE_WINDOW_SECONDS = 60;
const LOGIN_MAX_RATE_PER_WINDOW = 20;

function ensureSecurityDirectory()
{
    $dir = dirname(LOGIN_SECURITY_STORE_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function defaultLoginSecurityStore()
{
    return [
        'emails' => [],
        'ips' => []
    ];
}

function readLoginSecurityStore()
{
    ensureSecurityDirectory();
    if (!file_exists(LOGIN_SECURITY_STORE_FILE)) {
        return defaultLoginSecurityStore();
    }

    $raw = file_get_contents(LOGIN_SECURITY_STORE_FILE);
    if ($raw === false || trim($raw) === '') {
        return defaultLoginSecurityStore();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return defaultLoginSecurityStore();
    }

    if (!isset($decoded['emails']) || !is_array($decoded['emails'])) {
        $decoded['emails'] = [];
    }
    if (!isset($decoded['ips']) || !is_array($decoded['ips'])) {
        $decoded['ips'] = [];
    }

    return $decoded;
}

function writeLoginSecurityStore($store)
{
    ensureSecurityDirectory();
    file_put_contents(LOGIN_SECURITY_STORE_FILE, json_encode($store, JSON_PRETTY_PRINT));
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

function normalizeWindow($hits, $now)
{
    if (!is_array($hits)) return [];
    return array_values(array_filter($hits, function ($ts) use ($now) {
        return ($now - (int)$ts) <= LOGIN_RATE_WINDOW_SECONDS;
    }));
}

function ensureIdentityState($state)
{
    if (!is_array($state)) {
        $state = [];
    }
    if (!isset($state['failed_attempts'])) {
        $state['failed_attempts'] = 0;
    }
    if (!isset($state['locked_until'])) {
        $state['locked_until'] = 0;
    }
    if (!isset($state['window_hits']) || !is_array($state['window_hits'])) {
        $state['window_hits'] = [];
    }
    return $state;
}

function appendSecurityAuditLog($event, $email, $ip, $details = [])
{
    ensureSecurityDirectory();
    $entry = [
        'time' => libraryIsoTimestamp(),
        'event' => $event,
        'email_hash' => hash('sha256', strtolower($email)),
        'ip' => $ip,
        'details' => $details
    ];
    // Try to persist to DB if available, otherwise fallback to file
    $written = false;
    if (isset($conn) && $conn instanceof mysqli) {
        try {
            $event_time = date('Y-m-d H:i:s');
            $event_ts = round(microtime(true) * 1000);
            $details_json = json_encode($details);
            $stmt = $conn->prepare('INSERT INTO security_audit_logs (event_time, event_ts, event_key, email_hash, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
            if ($stmt) {
                $event_key = $event;
                $stmt->bind_param('sissss', $event_time, $event_ts, $event_key, $entry['email_hash'], $entry['ip'], $details_json);
                $ok = $stmt->execute();
                $stmt->close();
                if ($ok) $written = true;
            }
        } catch (Throwable $e) {
            $written = false;
        }
    }

    if (!$written) {
        file_put_contents(SECURITY_AUDIT_LOG_FILE, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

function invalidCredentialsResponse($extra = [])
{
    echo json_encode(array_merge([
        'success' => false,
        'message' => 'Invalid email or password.'
    ], $extra));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    $conn->close();
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = [];
}

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$ip = getClientIp();
$now = time();

if ($email === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'Email and password are required']);
    $conn->close();
    exit;
}

$allowedDomains = ['cvsu.edu.ph', 'gmail.com', 'yahoo.com'];
$parts = explode('@', $email);
if (count($parts) !== 2 || !in_array(strtolower($parts[1]), $allowedDomains)) {
    invalidCredentialsResponse();
    $conn->close();
    exit;
}

if (strlen($password) < 8 || strlen($password) > 16) {
    invalidCredentialsResponse();
    $conn->close();
    exit;
}

$emailKey = strtolower($email);
$store = readLoginSecurityStore();
$emailState = ensureIdentityState($store['emails'][$emailKey] ?? []);
$ipState = ensureIdentityState($store['ips'][$ip] ?? []);

$emailState['window_hits'] = normalizeWindow($emailState['window_hits'], $now);
$ipState['window_hits'] = normalizeWindow($ipState['window_hits'], $now);

$stmt = $conn->prepare('SELECT id, first_name, last_name, email, password, role, affiliation, institution_id FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
$stmt->close();

if ($user && password_verify($password, $user['password'])) {
    $emailState['failed_attempts'] = 0;
    $emailState['locked_until'] = 0;
    $ipState['failed_attempts'] = 0;
    $ipState['locked_until'] = 0;
    $store['emails'][$emailKey] = $emailState;
    $store['ips'][$ip] = $ipState;
    writeLoginSecurityStore($store);

    if ($user['role'] === 'admin' && isAdmin2faEnabled()) {
        $challengeId = trim((string)($data['challenge_id'] ?? ''));
        $otp = trim((string)($data['otp'] ?? ''));

        if ($challengeId === '' || $otp === '') {
            $challenge = createAdmin2faChallenge($email);
            if (!$challenge['success']) {
                echo json_encode([
                    'success' => false,
                    'message' => $challenge['message'] ?? 'Unable to start admin 2FA.'
                ]);
                $conn->close();
                exit;
            }

            $mailResult = sendAdminLoginOtpEmail($email, $user['first_name'] ?? 'Admin', $challenge['otp_code']);
            if (!$mailResult['success']) {
                removeAdmin2faChallenge($challenge['challenge_id']);
                echo json_encode([
                    'success' => false,
                    'message' => $mailResult['message'] ?? 'Unable to send admin 2FA code.'
                ]);
                $conn->close();
                exit;
            }

            appendSecurityAuditLog('admin_2fa_challenge_sent', $email, $ip, []);
            echo json_encode([
                'success' => true,
                'requires_2fa' => true,
                'challenge_id' => $challenge['challenge_id'],
                'message' => 'OTP sent to your admin email. It expires in 5 minutes.'
            ]);
            $conn->close();
            exit;
        }

        $verify = verifyAdmin2faChallenge($challengeId, $email, $otp);
        if (!$verify['success']) {
            appendSecurityAuditLog('admin_2fa_failed', $email, $ip, ['reason' => $verify['message'] ?? 'Invalid OTP']);
            echo json_encode([
                'success' => false,
                'requires_2fa' => true,
                'message' => $verify['message'] ?? 'Invalid 2FA code.'
            ]);
            $conn->close();
            exit;
        }

        appendSecurityAuditLog('admin_2fa_verified', $email, $ip, []);
    }

    $session = createSession($user, $ip, $_SERVER['HTTP_USER_AGENT'] ?? '');
    appendSecurityAuditLog('login_success', $email, $ip, ['role' => $user['role'], 'session_id' => $session['id']]);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'affiliation' => $user['affiliation'] ?? 'student',
            'institution_id' => $user['institution_id'] ?? null,
            'session_id' => $session['id']
        ]
    ]);
    $conn->close();
    exit;
}

if (($emailState['locked_until'] ?? 0) > $now || ($ipState['locked_until'] ?? 0) > $now) {
    $remaining = max((int)$emailState['locked_until'] - $now, (int)$ipState['locked_until'] - $now);
    appendSecurityAuditLog('login_locked_block', $email, $ip, ['remaining_seconds' => $remaining]);
    echo json_encode([
        'success' => false,
        'message' => 'Too many failed attempts. Try again later.',
        'retry_after_seconds' => $remaining
    ]);
    $conn->close();
    exit;
}

if (count($emailState['window_hits']) >= LOGIN_MAX_RATE_PER_WINDOW || count($ipState['window_hits']) >= LOGIN_MAX_RATE_PER_WINDOW) {
    $emailState['locked_until'] = $now + LOGIN_LOCK_SECONDS;
    $ipState['locked_until'] = $now + LOGIN_LOCK_SECONDS;
    $store['emails'][$emailKey] = $emailState;
    $store['ips'][$ip] = $ipState;
    writeLoginSecurityStore($store);
    appendSecurityAuditLog('login_rate_limited', $email, $ip, []);
    echo json_encode([
        'success' => false,
        'message' => 'Too many failed attempts. Try again later.',
        'retry_after_seconds' => LOGIN_LOCK_SECONDS
    ]);
    $conn->close();
    exit;
}

$emailState['window_hits'][] = $now;
$ipState['window_hits'][] = $now;

$emailState['failed_attempts'] = (int)$emailState['failed_attempts'] + 1;
$ipState['failed_attempts'] = (int)$ipState['failed_attempts'] + 1;

if ($emailState['failed_attempts'] >= LOGIN_MAX_FAILED_ATTEMPTS || $ipState['failed_attempts'] >= LOGIN_MAX_FAILED_ATTEMPTS) {
    $emailState['locked_until'] = $now + LOGIN_LOCK_SECONDS;
    $ipState['locked_until'] = $now + LOGIN_LOCK_SECONDS;
    appendSecurityAuditLog('login_suspicious_lockout', $email, $ip, [
        'email_failed_attempts' => $emailState['failed_attempts'],
        'ip_failed_attempts' => $ipState['failed_attempts']
    ]);
}

$store['emails'][$emailKey] = $emailState;
$store['ips'][$ip] = $ipState;
writeLoginSecurityStore($store);
appendSecurityAuditLog('login_failed', $email, $ip, [
    'email_failed_attempts' => $emailState['failed_attempts'],
    'ip_failed_attempts' => $ipState['failed_attempts']
]);

if (($emailState['locked_until'] ?? 0) > $now || ($ipState['locked_until'] ?? 0) > $now) {
    $remaining = max((int)$emailState['locked_until'] - $now, (int)$ipState['locked_until'] - $now);
    echo json_encode([
        'success' => false,
        'message' => 'Too many failed attempts. Try again later.',
        'retry_after_seconds' => $remaining
    ]);
} else {
    invalidCredentialsResponse();
}

$conn->close();
?>
