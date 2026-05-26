<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../penalty_settings_store.php';

$actor = requireAuthenticatedActor($_GET);
$user_id = (int)($actor['user_id'] ?? 0);

$policySettings = readPenaltySettings();
$policy = [
    "graceDays" => (int)($policySettings['grace_days'] ?? 7),
    "dailyFee" => (float)($policySettings['daily_fee'] ?? 150),
    "blockOverdueDays" => (int)($policySettings['block_overdue_days'] ?? 14)
];

$penaltyDue = 0.0;
$maxOverdueDays = 0;
$canBorrow = true;

$tableCheck = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
$hasBorrowTransactions = $tableCheck && $tableCheck->num_rows > 0;
if ($hasBorrowTransactions) {
    $stmt = $conn->prepare("SELECT due_at FROM borrow_transactions WHERE user_id = ? AND action = 'BORROW' AND status IN ('ACTIVE', 'OVERDUE')");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $today = new DateTimeImmutable('today');
    while ($row = $result->fetch_assoc()) {
        if (empty($row['due_at'])) {
            continue;
        }
        $dueDate = new DateTimeImmutable($row['due_at']);
        if ($dueDate >= $today) {
            continue;
        }
        $overdueDays = (int) $dueDate->diff($today)->format('%a');
        if ($overdueDays > $maxOverdueDays) {
            $maxOverdueDays = $overdueDays;
        }
        $chargeableDays = max(0, $overdueDays - $policy['graceDays']);
        $penaltyDue += $chargeableDays * $policy['dailyFee'];
    }

    $stmt->close();
    $canBorrow = $maxOverdueDays < $policy['blockOverdueDays'];
}

// Get total books in library
$stmt = $conn->prepare("SELECT COUNT(*) as total FROM books");
$stmt->execute();
$totalResult = $stmt->get_result()->fetch_assoc();
$totalBooks = $totalResult['total'];
$stmt->close();

$borrowed = 0;
$returned = 0;
$overdue = 0;

if ($hasBorrowTransactions) {
    // Get borrowed count (ACTIVE status)
    $stmt = $conn->prepare("SELECT COUNT(*) as borrowed FROM borrow_transactions WHERE user_id = ? AND status = 'ACTIVE'");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $borrowedResult = $stmt->get_result()->fetch_assoc();
    $borrowed = $borrowedResult['borrowed'];
    $stmt->close();

    // Get returned count (COMPLETED status)
    $stmt = $conn->prepare("SELECT COUNT(*) as returned FROM borrow_transactions WHERE user_id = ? AND status = 'COMPLETED'");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $returnedResult = $stmt->get_result()->fetch_assoc();
    $returned = $returnedResult['returned'];
    $stmt->close();

    // Get overdue count
    $stmt = $conn->prepare("SELECT COUNT(*) as overdue FROM borrow_transactions WHERE user_id = ? AND status = 'OVERDUE'");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $overdueResult = $stmt->get_result()->fetch_assoc();
    $overdue = $overdueResult['overdue'];
    $stmt->close();
}

echo json_encode([
    "success" => true,
    "data" => [
        "totalBooks" => (int)$totalBooks,
        "borrowed" => (int)$borrowed,
        "returned" => (int)$returned,
        "overdue" => (int)$overdue,
        "penaltyDue" => (float)$penaltyDue,
        "maxOverdueDays" => (int)$maxOverdueDays,
        "canBorrow" => (bool)$canBorrow,
        "graceDays" => (int)$policy['graceDays'],
        "dailyFee" => (int)$policy['dailyFee'],
        "blockOverdueDays" => (int)$policy['blockOverdueDays']
    ]
]);

$conn->close();
?>
