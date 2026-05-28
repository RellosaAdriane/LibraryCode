<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
applyCorsPolicy('GET, OPTIONS');
header('Content-Type: application/json');
require_once __DIR__ . '/../../db.php';

requireAdminActor($_GET);

$userId = (int)($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid user id.']);
    $conn->close();
    exit;
}

$tableCheck = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
if (!$tableCheck || $tableCheck->num_rows === 0) {
    echo json_encode(['success' => true, 'borrows' => []]);
    $conn->close();
    exit;
}

$stmt = $conn->prepare(
    "SELECT t.id AS transaction_id, t.book_id, b.title, t.borrowed_at, t.due_at, t.returned_at, t.status
     FROM borrow_transactions t
     JOIN books b ON t.book_id = b.id
     WHERE t.user_id = ? AND t.action = 'BORROW'
     ORDER BY COALESCE(t.borrowed_at, t.created_at) DESC
     LIMIT 25"
);

if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    $conn->close();
    exit;
}

$stmt->bind_param('i', $userId);
$stmt->execute();
$result = $stmt->get_result();

$borrows = [];
while ($row = $result->fetch_assoc()) {
    $borrows[] = [
        'id' => (int)$row['transaction_id'],
        'bookId' => (int)$row['book_id'],
        'title' => $row['title'],
        'borrowDate' => $row['borrowed_at'] ? date('Y-m-d', strtotime($row['borrowed_at'])) : null,
        'dueDate' => $row['due_at'] ? date('Y-m-d', strtotime($row['due_at'])) : null,
        'returnDate' => $row['returned_at'] ? date('Y-m-d', strtotime($row['returned_at'])) : null,
        'status' => strtolower($row['status'] ?? 'active'),
    ];
}

$stmt->close();
echo json_encode(['success' => true, 'borrows' => $borrows]);
$conn->close();
