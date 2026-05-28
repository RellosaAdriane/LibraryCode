<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
header('Content-Type: application/json');
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../datetime_utils.php';
initLibraryTimezone();

$actor = requireAuthenticatedActor($_GET);
$actorUserId = (int)($actor['user_id'] ?? 0);
$actorEmail = trim((string)($actor['email'] ?? ''));
$requestedEmail = trim((string)($_GET['email'] ?? ''));

if ($actorUserId <= 0 || $actorEmail === '') {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Authentication required"]);
    exit;
}

if ($requestedEmail !== '' && !filter_var($requestedEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid email format"]);
    exit;
}

$email = $actorEmail;
$user_id = $actorUserId;

if ($requestedEmail !== '') {
    $requestedEmail = filter_var($requestedEmail, FILTER_SANITIZE_EMAIL);
    if (strtolower($requestedEmail) !== strtolower($actorEmail) && ($actor['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Access denied"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $requestedEmail);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "User not found"]);
        exit;
    }

    $user = $result->fetch_assoc();
    $user_id = (int)$user['id'];
    $stmt->close();
}

// Get recent activity (last 10 transactions)
$stmt = $conn->prepare("
    SELECT 
        b.title as book_title,
        t.action,
        t.borrowed_at as date,
        t.status
    FROM borrow_transactions t
    JOIN books b ON t.book_id = b.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT 10
");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$activities = [];
while ($row = $result->fetch_assoc()) {
    $activities[] = [
        "book_title" => $row['book_title'],
        "action" => $row['action'],
        "date" => formatLibraryDate($row['date'] ?? null),
        "status" => $row['status']
    ];
}
$stmt->close();

echo json_encode([
    "success" => true,
    "data" => $activities
]);

$conn->close();
?>
