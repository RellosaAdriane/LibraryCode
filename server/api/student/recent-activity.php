<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../../request_auth.php';

// Validate email parameter
if (!isset($_GET['email']) || empty($_GET['email'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email parameter is required"]);
    exit;
}

$email = filter_var($_GET['email'], FILTER_SANITIZE_EMAIL);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid email format"]);
    exit;
}

// Check if user exists
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["success" => false, "message" => "User not found"]);
    exit;
}

$user = $result->fetch_assoc();
$user_id = $user['id'];
$stmt->close();

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
        "date" => $row['date'] ? date('Y-m-d', strtotime($row['date'])) : null,
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
