<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
applyCorsPolicy('GET, OPTIONS');
header('Content-Type: application/json');
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../datetime_utils.php';
initLibraryTimezone();

requireAdminActor($_GET);

$limit = max(1, min(20, (int)($_GET['limit'] ?? 10)));

$tableCheck = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
if (!$tableCheck || $tableCheck->num_rows === 0) {
    echo json_encode(['success' => true, 'activities' => []]);
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

$stmt = $conn->prepare(
    "SELECT t.id AS transaction_id, t.status, b.title,
            u.first_name, u.last_name, u.email,
            CASE
                WHEN t.status = 'COMPLETED' THEN 'return'
                WHEN t.status = 'OVERDUE' THEN 'overdue'
                ELSE 'borrow'
            END AS activity_type,
            CASE
                WHEN t.status = 'COMPLETED' THEN COALESCE(t.returned_at, t.created_at)
                ELSE COALESCE(t.borrowed_at, t.created_at)
            END AS activity_at
     FROM borrow_transactions t
     JOIN books b ON t.book_id = b.id
     JOIN users u ON t.user_id = u.id
     WHERE t.action = 'BORROW'
     ORDER BY activity_at DESC
     LIMIT ?"
);

$activities = [];
if ($stmt) {
    $stmt->bind_param('i', $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $type = (string)($row['activity_type'] ?? 'borrow');
        $activities[] = [
            'id' => (int)$row['transaction_id'],
            'studentName' => mapStudentName($row),
            'title' => $row['title'] ?? '',
            'type' => $type,
            'action' => $type === 'return'
                ? 'returned'
                : ($type === 'overdue' ? 'has overdue loan for' : 'borrowed'),
            'activityAt' => formatLibraryIso($row['activity_at'] ?? null),
        ];
    }
    $stmt->close();
}

echo json_encode([
    'success' => true,
    'activities' => $activities,
]);
$conn->close();
