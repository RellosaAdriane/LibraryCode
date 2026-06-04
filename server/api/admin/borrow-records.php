<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
applyCorsPolicy('GET, OPTIONS');
header('Content-Type: application/json');
require_once __DIR__ . '/../../db.php';

requireAdminActor($_GET);

$type = strtolower(trim((string)($_GET['type'] ?? 'all')));
$includeActive = $type === 'all' || $type === 'active';
$includeReturned = $type === 'all' || $type === 'returned';
$limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));

$tableCheck = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
if (!$tableCheck || $tableCheck->num_rows === 0) {
    echo json_encode([
        'success' => true,
        'active' => [],
        'returned' => [],
        'counts' => ['active' => 0, 'returned' => 0],
    ]);
    $conn->close();
    exit;
}

function mapStudentName(array $row): string
{
    $first = trim((string)($row['first_name'] ?? ''));
    $last = trim((string)($row['last_name'] ?? ''));
    $full = trim($first . ' ' . $last);
    if ($full !== '') {
        return $full;
    }
    return trim((string)($row['email'] ?? '')) ?: 'Unknown Student';
}

$active = [];
$returned = [];
$activeCount = 0;
$returnedCount = 0;

if ($includeActive) {
    $countResult = $conn->query(
        "SELECT COUNT(*) AS total
         FROM borrow_transactions
         WHERE action = 'BORROW' AND status IN ('ACTIVE', 'OVERDUE')"
    );
    if ($countResult) {
        $countRow = $countResult->fetch_assoc();
        $activeCount = (int)($countRow['total'] ?? 0);
        $countResult->free();
    }

    $stmt = $conn->prepare(
        "SELECT t.id AS transaction_id, t.book_id, b.title, t.borrowed_at, t.due_at, t.status,
                u.id AS user_id, u.first_name, u.last_name, u.email
         FROM borrow_transactions t
         JOIN books b ON t.book_id = b.id
         JOIN users u ON t.user_id = u.id
         WHERE t.action = 'BORROW' AND t.status IN ('ACTIVE', 'OVERDUE')
         ORDER BY COALESCE(t.borrowed_at, t.created_at) DESC
         LIMIT ?"
    );

    if ($stmt) {
        $stmt->bind_param('i', $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $active[] = [
                'id' => (int)$row['transaction_id'],
                'userId' => (int)$row['user_id'],
                'studentName' => mapStudentName($row),
                'email' => $row['email'] ?? '',
                'bookId' => (int)$row['book_id'],
                'title' => $row['title'] ?? '',
                'borrowDate' => formatLibraryDate($row['borrowed_at'] ?? null),
                'dueDate' => formatLibraryDate($row['due_at'] ?? null),
                'status' => strtolower($row['status'] ?? 'active'),
            ];
        }
        $stmt->close();
    }
}

if ($includeReturned) {
    $countResult = $conn->query(
        "SELECT COUNT(*) AS total
         FROM borrow_transactions
         WHERE action = 'BORROW' AND status = 'COMPLETED'"
    );
    if ($countResult) {
        $countRow = $countResult->fetch_assoc();
        $returnedCount = (int)($countRow['total'] ?? 0);
        $countResult->free();
    }

    $stmt = $conn->prepare(
        "SELECT t.id AS transaction_id, t.book_id, b.title, t.borrowed_at, t.returned_at, t.status,
                t.overdue_days, t.penalty_amount,
                u.id AS user_id, u.first_name, u.last_name, u.email
         FROM borrow_transactions t
         JOIN books b ON t.book_id = b.id
         JOIN users u ON t.user_id = u.id
         WHERE t.action = 'BORROW' AND t.status = 'COMPLETED'
         ORDER BY COALESCE(t.returned_at, t.created_at) DESC
         LIMIT ?"
    );

    if ($stmt) {
        $stmt->bind_param('i', $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $returned[] = [
                'id' => (int)$row['transaction_id'],
                'userId' => (int)$row['user_id'],
                'studentName' => mapStudentName($row),
                'email' => $row['email'] ?? '',
                'bookId' => (int)$row['book_id'],
                'title' => $row['title'] ?? '',
                'borrowDate' => formatLibraryDate($row['borrowed_at'] ?? null),
                'returnDate' => formatLibraryDate($row['returned_at'] ?? null),
                'status' => strtolower($row['status'] ?? 'completed'),
                'overdueDays' => (int)($row['overdue_days'] ?? 0),
                'penaltyAmount' => (float)($row['penalty_amount'] ?? 0),
            ];
        }
        $stmt->close();
    }
}

echo json_encode([
    'success' => true,
    'active' => $active,
    'returned' => $returned,
    'counts' => [
        'active' => $activeCount,
        'returned' => $returnedCount,
    ],
]);
$conn->close();
