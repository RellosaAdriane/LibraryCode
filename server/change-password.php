<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/db.php';

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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Invalid request method"]);
    $conn->close();
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    $data = [];
}

$email = trim($data['email'] ?? '');
$currentPassword = $data['current_password'] ?? '';
$newPassword = $data['new_password'] ?? '';

// Prefer the session actor's email when present, but always verify the current password.
$actor = resolveAuthenticatedActor($data);
if ($actor) {
    $email = $actor['email'] ?? $email;
}

if ($email === '' || $currentPassword === '' || $newPassword === '') {
    echo json_encode(["success" => false, "message" => "Email, current password, and new password are required."]);
    $conn->close();
    exit;
}

$allowedDomains = ["cvsu.edu.ph", "gmail.com", "yahoo.com"];
$parts = explode("@", $email);
if (count($parts) !== 2 || !in_array(strtolower($parts[1]), $allowedDomains)) {
    echo json_encode(["success" => false, "message" => "Invalid email address."]);
    $conn->close();
    exit;
}

if (strlen($newPassword) < 8 || strlen($newPassword) > 16 || preg_match('/\s/', $newPassword)) {
    echo json_encode(["success" => false, "message" => "Password must be 8 to 16 characters without spaces."]);
    $conn->close();
    exit;
}

if (passwordStrengthScore($newPassword) <= 2) {
    echo json_encode(["success" => false, "message" => "Weak password detected. Please use a medium or strong password."]);
    $conn->close();
    exit;
}

$stmt = $conn->prepare("SELECT password FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
$stmt->close();

if (!$user) {
    echo json_encode(["success" => false, "message" => "User account not found."]);
    $conn->close();
    exit;
}

if (!password_verify($currentPassword, $user['password'] ?? '')) {
    echo json_encode(["success" => false, "message" => "Current password is incorrect."]);
    $conn->close();
    exit;
}

if (password_verify($newPassword, $user['password'] ?? '')) {
    echo json_encode(["success" => false, "message" => "For security, do not reuse your old password. Please create a new one."]);
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
    echo json_encode(["success" => false, "message" => "Failed to update password. Please try again."]);
    $conn->close();
    exit;
}

echo json_encode(["success" => true, "message" => "Password updated successfully."]);
$conn->close();
?>
