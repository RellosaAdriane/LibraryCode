<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../request_auth.php';

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

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param('s', $email);
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

$stmt = $conn->prepare(
    "SELECT t.id as transaction_id, t.book_id, b.title, t.borrowed_at, t.due_at, t.status
     FROM borrow_transactions t
     JOIN books b ON t.book_id = b.id
     WHERE t.user_id = ? AND t.action = 'BORROW' AND t.status IN ('ACTIVE','OVERDUE')
     ORDER BY t.created_at DESC"
);
$stmt->bind_param('i', $user_id);
$stmt->execute();
$result = $stmt->get_result();

$items = [];
while ($row = $result->fetch_assoc()) {
    $items[] = [
        'id' => (int)$row['transaction_id'],
        'bookId' => (int)$row['book_id'],
        'title' => $row['title'],
        'borrowDate' => $row['borrowed_at'] ? date('Y-m-d', strtotime($row['borrowed_at'])) : null,
        'dueDate' => $row['due_at'] ? date('Y-m-d', strtotime($row['due_at'])) : null,
        'status' => strtolower($row['status'] ?? 'active')
    ];
}
$stmt->close();

echo json_encode(["success" => true, "data" => $items]);

$conn->close();
?>
