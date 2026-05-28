<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
require_once __DIR__ . '/../../db.php';

$actor = requireAuthenticatedActor($_GET);
$userId = (int)($actor['user_id'] ?? 0);

$tableCheck = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
if (!$tableCheck || $tableCheck->num_rows === 0) {
    echo json_encode(["success" => true, "data" => []]);
    $conn->close();
    exit;
}

$stmt = $conn->prepare(
    "SELECT t.id as transaction_id, t.book_id, b.title, t.borrowed_at, t.returned_at, t.status, t.overdue_days, t.penalty_amount
     FROM borrow_transactions t
     JOIN books b ON t.book_id = b.id
     WHERE t.user_id = ? AND t.action = 'BORROW' AND t.status = 'COMPLETED'
     ORDER BY t.returned_at DESC, t.created_at DESC"
);

if (!$stmt) {
    echo json_encode(["success" => false, "message" => "Unable to load returned books."]);
    $conn->close();
    exit;
}

$stmt->bind_param('i', $userId);
$stmt->execute();
$result = $stmt->get_result();

$items = [];
while ($row = $result->fetch_assoc()) {
    $items[] = [
        'id' => (int)$row['transaction_id'],
        'bookId' => (int)$row['book_id'],
        'title' => $row['title'],
        'borrowDate' => formatLibraryDate($row['borrowed_at'] ?? null),
        'returnDate' => formatLibraryDate($row['returned_at'] ?? null),
        'status' => strtolower($row['status'] ?? 'completed'),
        'overdueDays' => (int)($row['overdue_days'] ?? 0),
        'penaltyAmount' => (float)($row['penalty_amount'] ?? 0)
    ];
}

$stmt->close();
echo json_encode(["success" => true, "data" => $items]);
$conn->close();
?>
