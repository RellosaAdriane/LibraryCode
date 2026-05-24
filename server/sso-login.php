<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

include 'db.php';
require_once __DIR__ . '/request_auth.php';
require_once __DIR__ . '/sso_settings_store.php';
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
if ($email === '') {
    echo json_encode(['success' => false, 'message' => 'Email is required.']);
    $conn->close();
    exit;
}

$settings = readSsoSettings();
if (!(bool)($settings['enabled'] ?? false)) {
    echo json_encode(['success' => false, 'message' => 'SSO is currently disabled.']);
    $conn->close();
    exit;
}

$parts = explode('@', $email);
if (count($parts) !== 2) {
    echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
    $conn->close();
    exit;
}

$domain = strtolower($parts[1]);
$allowedDomains = $settings['allowed_domains'] ?? [];
if (is_array($allowedDomains) && count($allowedDomains) > 0 && !in_array($domain, $allowedDomains, true)) {
    echo json_encode(['success' => false, 'message' => 'Email domain is not allowed for SSO.']);
    $conn->close();
    exit;
}

$stmt = $conn->prepare('SELECT id, first_name, last_name, email, role, affiliation, institution_id FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
$stmt->close();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'No account found for this email.']);
    $conn->close();
    exit;
}

if (!empty($settings['admin_only']) && $user['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'SSO login is restricted to admins.']);
    $conn->close();
    exit;
}

$session = createSession($user, getClientIp(), $_SERVER['HTTP_USER_AGENT'] ?? '');

echo json_encode([
    'success' => true,
    'message' => 'SSO login successful',
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
?>
