<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

include 'db.php';
require_once __DIR__ . '/request_auth.php';
require_once __DIR__ . '/session_store.php';

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

function failResponse($message)
{
    echo json_encode(['success' => false, 'message' => $message]);
}

function httpJsonGet($url)
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch) {
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_HTTPHEADER => ['User-Agent: LibraryCode/GoogleAuth']
            ]);

            $raw = curl_exec($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($raw === false || $status < 200 || $status >= 300) {
                return [false, null];
            }

            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                return [false, null];
            }

            return [true, $decoded];
        }
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => "User-Agent: LibraryCode/GoogleAuth\r\n"
        ],
        'https' => [
            'timeout' => 10
        ]
    ]);

    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        return [false, null];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [false, null];
    }

    return [true, $decoded];
}

// Link OTP store helpers
const LINK_OTP_FILE = __DIR__ . '/tmp/google_link_otp_store.json';

function ensureLinkOtpDir()
{
    $dir = dirname(LINK_OTP_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function readLinkOtpStore()
{
    ensureLinkOtpDir();
    if (!file_exists(LINK_OTP_FILE)) return [];
    $raw = file_get_contents(LINK_OTP_FILE);
    if ($raw === false || $raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function writeLinkOtpStore($store)
{
    ensureLinkOtpDir();
    file_put_contents(LINK_OTP_FILE, json_encode($store, JSON_PRETTY_PRINT));
}

function splitGoogleName($fullName, $email)
{
    $fullName = trim((string)$fullName);
    if ($fullName !== '') {
        $parts = preg_split('/\s+/', $fullName);
        if (is_array($parts) && count($parts) > 1) {
            $first = trim((string)array_shift($parts));
            $last = trim((string)implode(' ', $parts));
            if ($first !== '' && $last !== '') {
                return [$first, $last];
            }
        }

        return [$fullName, 'User'];
    }

    $emailParts = explode('@', strtolower((string)$email));
    $localPart = $emailParts[0] ?? 'google';
    $localPart = preg_replace('/[^A-Za-z0-9]+/', ' ', $localPart);
    $localPart = trim((string)$localPart);

    if ($localPart === '') {
        return ['Google', 'User'];
    }

    $parts = preg_split('/\s+/', $localPart);
    if (is_array($parts) && count($parts) > 1) {
        $first = ucfirst($parts[0]);
        $last = ucfirst(implode(' ', array_slice($parts, 1)));
        return [$first, $last];
    }

    return [ucfirst($localPart), 'User'];
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    failResponse('Invalid request method');
    $conn->close();
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = [];
}

$credential = trim((string)($data['credential'] ?? ''));
if ($credential === '') {
    failResponse('Google credential is required.');
    $conn->close();
    exit;
}

$clientId = getGoogleClientId();
if ($clientId === '') {
    failResponse('Google sign-in is not configured on the server.');
    $conn->close();
    exit;
}

$tokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential);
[$ok, $payload] = httpJsonGet($tokenInfoUrl);
if (!$ok || !is_array($payload)) {
    failResponse('Unable to verify Google account right now.');
    $conn->close();
    exit;
}

$issuer = strtolower((string)($payload['iss'] ?? ''));
$allowedIssuers = ['accounts.google.com', 'https://accounts.google.com'];
if (!in_array($issuer, $allowedIssuers, true)) {
    failResponse('Invalid Google token issuer.');
    $conn->close();
    exit;
}

if (($payload['aud'] ?? '') !== $clientId) {
    failResponse('Google account does not match this application.');
    $conn->close();
    exit;
}

$email = trim((string)($payload['email'] ?? ''));
$subject = trim((string)($payload['sub'] ?? ''));
$emailVerified = $payload['email_verified'] ?? false;

if ($email === '' || $subject === '') {
    failResponse('Google account data is incomplete.');
    $conn->close();
    exit;
}

$emailVerifiedText = strtolower((string)$emailVerified);
if (!in_array($emailVerifiedText, ['true', '1', 'yes'], true) && $emailVerified !== true) {
    failResponse('Google email must be verified.');
    $conn->close();
    exit;
}

$givenName = trim((string)($payload['given_name'] ?? ''));
$familyName = trim((string)($payload['family_name'] ?? ''));
if ($givenName === '' || $familyName === '') {
    [$givenName, $familyName] = splitGoogleName($payload['name'] ?? '', $email);
}

$picture = trim((string)($payload['picture'] ?? ''));
$clientIp = getClientIp();
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

$stmt = $conn->prepare('SELECT id, first_name, last_name, email, role, affiliation, institution_id, auth_provider, google_sub FROM users WHERE google_sub = ? LIMIT 1');
$user = null;
if ($stmt) {
    $stmt->bind_param('s', $subject);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
    $stmt->close();
}

$accountCreated = false;

// If not found by google_sub, try matching by email
if (!$user) {
    $stmt = $conn->prepare('SELECT id, first_name, last_name, email, password, role, affiliation, institution_id, auth_provider, google_sub FROM users WHERE email = ? LIMIT 1');
    if ($stmt) {
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
        $stmt->close();
    }
}

if ($user) {
    // If account exists by email but isn't linked to Google, require password confirmation to link.
    if (($user['auth_provider'] ?? '') !== 'google') {
        $linkOtp = trim((string)($data['link_otp'] ?? ''));
        // If client provided an OTP, verify it
        if ($linkOtp !== '') {
            $store = readLinkOtpStore();
            $key = strtolower($user['email']);
            $entry = $store[$key] ?? null;
            if (!is_array($entry)) {
                echo json_encode(['success' => false, 'message' => 'No OTP found. Please request a new code.']);
                $conn->close();
                exit;
            }

            if (($entry['expires_at'] ?? 0) < time()) {
                unset($store[$key]);
                writeLinkOtpStore($store);
                echo json_encode(['success' => false, 'message' => 'OTP expired. Request a new code.']);
                $conn->close();
                exit;
            }

            $attempts = (int)($entry['attempts'] ?? 0);
            if ($attempts >= 5) {
                unset($store[$key]);
                writeLinkOtpStore($store);
                echo json_encode(['success' => false, 'message' => 'Too many invalid attempts. Request a new code.']);
                $conn->close();
                exit;
            }

            if (!password_verify($linkOtp, $entry['otp_hash'] ?? '')) {
                $store[$key]['attempts'] = $attempts + 1;
                writeLinkOtpStore($store);
                echo json_encode(['success' => false, 'message' => 'Invalid OTP.']);
                $conn->close();
                exit;
            }

            // OTP valid: link account
            unset($store[$key]);
            writeLinkOtpStore($store);
            $authProvider = 'google';
            $updateStmt = $conn->prepare('UPDATE users SET auth_provider = ?, google_sub = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            if ($updateStmt) {
                $updateStmt->bind_param('ssi', $authProvider, $subject, $user['id']);
                $updateStmt->execute();
                $updateStmt->close();
            }
            $user['auth_provider'] = 'google';
            $user['google_sub'] = $subject;
            unset($user['password']);
        } else {
            // Send OTP to the user's email and prompt client to enter it
            $otpCode = (string) random_int(100000, 999999);
            $store = readLinkOtpStore();
            $key = strtolower($user['email']);
            $store[$key] = [
                'otp_hash' => password_hash($otpCode, PASSWORD_DEFAULT),
                'expires_at' => time() + 300,
                'attempts' => 0
            ];
            writeLinkOtpStore($store);

            // Use sendSignupOtpEmail for sending the code
            require_once __DIR__ . '/mailer.php';
            $mailResult = sendSignupOtpEmail($user['email'], $user['first_name'] ?? '', $otpCode);
            if (!$mailResult['success']) {
                echo json_encode(['success' => false, 'message' => $mailResult['message']]);
                $conn->close();
                exit;
            }

            echo json_encode(['success' => false, 'needs_link_otp' => true, 'message' => 'OTP sent to your email.']);
            $conn->close();
            exit;
        }
    } else {
        // already linked: ensure google_sub updated
        $authProvider = 'google';
        $updateStmt = $conn->prepare('UPDATE users SET auth_provider = ?, google_sub = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        if ($updateStmt) {
            $updateStmt->bind_param('ssi', $authProvider, $subject, $user['id']);
            $updateStmt->execute();
            $updateStmt->close();
        }
        $user['auth_provider'] = 'google';
        $user['google_sub'] = $subject;
        unset($user['password']);
    }
} else {
    // No user found — create only when client explicitly requested signup
    $authProvider = 'google';
    $passwordSeed = bin2hex(random_bytes(16));
    $hashedPassword = password_hash($passwordSeed, PASSWORD_DEFAULT);
    $role = 'student';
    $affiliation = 'student';
    $institutionId = null;

    $requestedAction = strtolower(trim((string)($data['action'] ?? 'login')));
    if ($requestedAction === 'signup') {
        $insertStmt = $conn->prepare('INSERT INTO users (first_name, last_name, email, password, role, affiliation, institution_id, auth_provider, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        if ($insertStmt) {
            $insertStmt->bind_param('sssssssss', $givenName, $familyName, $email, $hashedPassword, $role, $affiliation, $institutionId, $authProvider, $subject);
            $insertStmt->execute();
            $newId = $insertStmt->insert_id;
            $insertStmt->close();

            $stmt = $conn->prepare('SELECT id, first_name, last_name, email, role, affiliation, institution_id FROM users WHERE id = ? LIMIT 1');
            if ($stmt) {
                $stmt->bind_param('i', $newId);
                $stmt->execute();
                $result = $stmt->get_result();
                $user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
                $stmt->close();
            }
            $accountCreated = true;
        }
    } else {
        $profile = [
            'first_name' => $givenName,
            'last_name' => $familyName,
            'email' => $email,
            'google_sub' => $subject,
            'picture' => $picture
        ];
        echo json_encode([
            'success' => false,
            'needs_signup' => true,
            'message' => 'No account linked to this Google account. Please complete signup.',
            'profile' => $profile
        ]);
        $conn->close();
        exit;
    }
}

if (!$user) {
    failResponse('Unable to create or load your account.');
    $conn->close();
    exit;
}

if (!isset($user['role'])) {
    $user['role'] = 'student';
}
if (!isset($user['affiliation'])) {
    $user['affiliation'] = 'student';
}

$session = createSession($user, $clientIp, $userAgent);

echo json_encode([
    'success' => true,
    'message' => $accountCreated ? 'Google account created and signed in.' : 'Google sign-in successful.',
    'account_created' => $accountCreated,
    'user' => [
        'id' => $user['id'],
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'affiliation' => $user['affiliation'] ?? 'student',
        'institution_id' => $user['institution_id'] ?? null,
        'session_id' => $session['id'],
        'auth_provider' => 'google',
        'google_picture' => $picture
    ]
]);

$conn->close();
?>