<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/../../db.php';

$actor = requireAuthenticatedActor($_GET);
$user_id = (int)($actor['user_id'] ?? 0);

if ($user_id <= 0) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Authentication required"]);
    exit;
}

$tableCheck = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
if (!$tableCheck || $tableCheck->num_rows === 0) {
    echo json_encode(["success" => true, "data" => []]);
    $conn->close();
    exit;
}

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
