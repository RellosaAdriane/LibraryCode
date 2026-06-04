<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/signup_settings_store.php';
require_once __DIR__ . '/otp_store.php';

const OTP_TTL_SECONDS = 300;
const OTP_MAX_ATTEMPTS = 5;
const OTP_STORE_FILE = __DIR__ . '/tmp/signup_otp_store.json';

function ensureOtpStoreDirectory()
{
    $dir = dirname(OTP_STORE_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function readOtpStore()
{
    ensureOtpStoreDirectory();
    if (!file_exists(OTP_STORE_FILE)) {
        return [];
    }

    $raw = file_get_contents(OTP_STORE_FILE);
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function writeOtpStore($store)
{
    ensureOtpStoreDirectory();
    file_put_contents(OTP_STORE_FILE, json_encode($store, JSON_PRETTY_PRINT));
}

// Helper: find an entry in the OTP store by a normalized email key (case-insensitive, trimmed)
function findOtpEntryKey(array $store, string $emailKey)
{
    $needle = strtolower(trim($emailKey));
    foreach ($store as $k => $v) {
        if (strtolower(trim((string)$k)) === $needle) {
            return $k;
        }
    }
    return null;
}

function isValidRealName($name)
{
    $trimmed = trim((string)$name);
    if ($trimmed === '') {
        return false;
    }

    if (!preg_match("/^[A-Za-z][A-Za-z\\s'\\-]*$/", $trimmed)) {
        return false;
    }

    $lettersOnly = preg_replace('/[^A-Za-z]/', '', $trimmed);
    return strlen($lettersOnly) >= 3;
}

function isValidBirthdayDate($birthday)
{
    if ($birthday === null || $birthday === '') {
        return true;
    }

    $date = DateTime::createFromFormat('Y-m-d', $birthday);
    if (!$date || $date->format('Y-m-d') !== $birthday) {
        return false;
    }

    $today = libraryTodayStart();
    return $date <= $today;
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

// Get POST data
$data = json_decode(file_get_contents("php://input"), true);

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $action = trim(strtolower($data['action'] ?? ''));
    $first_name = trim($data['first_name'] ?? '');
    $last_name = trim($data['last_name'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $birthday = $data['birthday'] ?? null;
    $gender = $data['gender'] ?? null;
    $affiliation = trim(strtolower((string)($data['affiliation'] ?? 'student')));
    $institution_id = trim((string)($data['institution_id'] ?? ''));
    $otp = trim((string)($data['otp'] ?? ''));
    $google_credential = trim((string)($data['google_credential'] ?? ''));

    // Validation
    if (empty($first_name) || empty($last_name) || empty($email) || empty($password)) {
        echo json_encode(["success" => false, "message" => "All fields are required"]);
        exit;
    }

    if (!isValidRealName($first_name)) {
        echo json_encode(["success" => false, "message" => "First name is not acceptable. Please input a real name (minimum 3 letters, no numbers)."]);
        exit;
    }

    if (!isValidRealName($last_name)) {
        echo json_encode(["success" => false, "message" => "Last name is not acceptable. Please input a real name (minimum 3 letters, no numbers)."]);
        exit;
    }

    if (!isValidBirthdayDate($birthday)) {
        echo json_encode(["success" => false, "message" => "Birthday is not valid. Please select a real date that is not in the future."]);
        exit;
    }

    // Check email domain
    $allowedDomains = ["cvsu.edu.ph", "gmail.com", "yahoo.com"];
    $parts = explode("@", $email);
    if (count($parts) !== 2 || !in_array(strtolower($parts[1]), $allowedDomains)) {
        echo json_encode(["success" => false, "message" => "Email must be cvsu.edu.ph, gmail.com or yahoo.com"]);
        exit;
    }

    // Check password length
    if (strlen($password) < 8 || strlen($password) > 16) {
        echo json_encode(["success" => false, "message" => "Password must be 8 to 16 characters"]);
        exit;
    }

    // Validate affiliation
    $allowedAffiliations = ['student', 'staff'];
    if (!in_array($affiliation, $allowedAffiliations, true)) {
        $affiliation = 'student';
    }

    $google_sub = null;
    if ($google_credential !== '') {
        $clientId = getGoogleClientId();
        if ($clientId === '') {
            echo json_encode(["success" => false, "message" => "Google sign-in is not configured on the server."]);
            exit;
        }

        $tokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($google_credential);
        [$ok, $payload] = httpJsonGet($tokenInfoUrl);
        if (!$ok || !is_array($payload)) {
            echo json_encode(["success" => false, "message" => "Unable to verify Google account right now."]);
            exit;
        }

        $issuer = strtolower((string)($payload['iss'] ?? ''));
        $allowedIssuers = ['accounts.google.com', 'https://accounts.google.com'];
        if (!in_array($issuer, $allowedIssuers, true)) {
            echo json_encode(["success" => false, "message" => "Invalid Google token issuer."]);
            exit;
        }

        if (($payload['aud'] ?? '') !== $clientId) {
            echo json_encode(["success" => false, "message" => "Google account does not match this application."]);
            exit;
        }

        $googleEmail = trim((string)($payload['email'] ?? ''));
        $googleSubValue = trim((string)($payload['sub'] ?? ''));
        $emailVerified = $payload['email_verified'] ?? false;

        if ($googleEmail === '' || $googleSubValue === '') {
            echo json_encode(["success" => false, "message" => "Google account data is incomplete."]);
            exit;
        }

        $emailVerifiedText = strtolower((string)$emailVerified);
        if (!in_array($emailVerifiedText, ['true', '1', 'yes'], true) && $emailVerified !== true) {
            echo json_encode(["success" => false, "message" => "Google email must be verified."]);
            exit;
        }

        if (strtolower($googleEmail) !== strtolower($email)) {
            echo json_encode(["success" => false, "message" => "Google email does not match the email in the signup form."]);
            exit;
        }

        $google_sub = $googleSubValue;
        $email = $googleEmail;
    }

    // Validate institution id
    if ($institution_id === '' || !preg_match('/^[A-Za-z0-9-]{6,20}$/', $institution_id)) {
        echo json_encode(["success" => false, "message" => "Institution ID must be 6 to 20 letters, numbers, or hyphens"]);
        exit;
    }

    // Check if institution ID already exists
    $checkInstitutionStmt = $conn->prepare("SELECT id FROM users WHERE institution_id = ? LIMIT 1");
    $checkInstitutionStmt->bind_param("s", $institution_id);
    $checkInstitutionStmt->execute();
    $checkInstitutionResult = $checkInstitutionStmt->get_result();

    if ($checkInstitutionResult->num_rows > 0) {
        echo json_encode(["success" => false, "message" => "Institution ID already registered"]);
        $checkInstitutionStmt->close();
        exit;
    }
    $checkInstitutionStmt->close();

    // Check if email already exists
    $checkStmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $checkStmt->bind_param("s", $email);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();

    if ($checkResult->num_rows > 0) {
        echo json_encode(["success" => false, "message" => "Email already registered"]);
        $checkStmt->close();
        exit;
    }
    $checkStmt->close();

    // Default behavior: if no OTP is supplied yet, send OTP first.
    $effectiveAction = $action;
    if ($effectiveAction === '') {
        $effectiveAction = $otp === '' ? 'send_otp' : 'verify_otp';
    }

    $emailVerificationEnabled = isSignupEmailVerificationEnabled();
    if (!$emailVerificationEnabled) {
        $effectiveAction = 'register_direct';
    }
    if ($effectiveAction === 'send_otp') {
        $otpCode = (string) random_int(100000, 999999);
        $ok = otp_set_record('signup', $email, password_hash($otpCode, PASSWORD_DEFAULT), libraryUnixTime() + OTP_TTL_SECONDS, 0, libraryUnixTime());

        if (!$ok) {
            echo json_encode(["success" => false, "message" => "Unable to write OTP record"]);
            exit;
        }

        $mailResult = sendSignupOtpEmail($email, $first_name, $otpCode);
        if (!$mailResult['success']) {
            otp_delete_record('signup', $email);
            echo json_encode([
                "success" => false,
                "message" => $mailResult['message']
            ]);
            exit;
        }

        echo json_encode([
            "success" => true,
            "otp_required" => true,
            "message" => "OTP sent to your email. It expires in 5 minutes."
        ]);
        exit;
    }

    if ($effectiveAction !== 'verify_otp' && $effectiveAction !== 'register_direct') {
        echo json_encode(["success" => false, "message" => "Invalid action"]);
        exit;
    }

    $emailKey = strtolower($email);

    if ($effectiveAction === 'verify_otp') {
        if ($otp === '' || !preg_match('/^\d{6}$/', $otp)) {
            echo json_encode(["success" => false, "message" => "A valid 6-digit OTP is required"]);
            exit;
        }
        $rec = otp_get_record('signup', $email);
        if (!is_array($rec)) {
            echo json_encode(["success" => false, "message" => "OTP not found. Please request a new OTP."]);
            exit;
        }

        if (($rec['expires_at'] ?? 0) < libraryUnixTime()) {
            otp_delete_record('signup', $email);
            echo json_encode(["success" => false, "message" => "OTP has expired. Please request a new OTP."]);
            exit;
        }

        $attempts = (int)($rec['attempts'] ?? 0);
        if ($attempts >= OTP_MAX_ATTEMPTS) {
            otp_delete_record('signup', $email);
            echo json_encode(["success" => false, "message" => "Too many invalid OTP attempts. Request a new OTP."]);
            exit;
        }

        if (!password_verify($otp, $rec['otp_hash'] ?? '')) {
            otp_increment_attempts('signup', $email);
            echo json_encode(["success" => false, "message" => "Invalid OTP"]);
            exit;
        }
    }

    // Hash password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // Insert user with default role='student'
    $role = 'student';
    if ($google_sub !== null) {
        $auth_provider = 'google';
        $stmt = $conn->prepare("INSERT INTO users (first_name, last_name, email, password, birthday, gender, role, affiliation, institution_id, auth_provider, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssssssss", $first_name, $last_name, $email, $hashed_password, $birthday, $gender, $role, $affiliation, $institution_id, $auth_provider, $google_sub);
    } else {
        $stmt = $conn->prepare("INSERT INTO users (first_name, last_name, email, password, birthday, gender, role, affiliation, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ? , ?)");
        $stmt->bind_param("sssssssss", $first_name, $last_name, $email, $hashed_password, $birthday, $gender, $role, $affiliation, $institution_id);
    }

    if ($stmt->execute()) {
        if ($effectiveAction === 'verify_otp') {
            otp_delete_record('signup', $email);
        }
        echo json_encode([
            "success" => true,
            "message" => $emailVerificationEnabled ? "Registration successful" : "Registration successful. Email verification is disabled.",
            "otp_required" => false
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Registration failed"]);
    }

    $stmt->close();
} else {
    echo json_encode(["success" => false, "message" => "Invalid request method"]);
}

$conn->close();
?>
