<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

include __DIR__ . '/../../db.php';
    require_once __DIR__ . '/../request_auth.php';
require_once __DIR__ . '/../../penalty_settings_store.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    $conn->close();
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Invalid request method"]);
    $conn->close();
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) $data = [];

$email = trim($data['email'] ?? '');
$transactionId = isset($data['transaction_id']) ? (int)$data['transaction_id'] : 0;
$bookId = isset($data['book_id']) ? (int)$data['book_id'] : 0;

if ($email === '' || ($transactionId <= 0 && $bookId <= 0)) {
    echo json_encode(["success" => false, "message" => "Email and transaction_id or book_id are required."]);
    $conn->close();
    exit;
}

// load penalty settings
$penaltySettings = readPenaltySettings();
$graceDays = (int)($penaltySettings['grace_days'] ?? 7);
$dailyFee = (float)($penaltySettings['daily_fee'] ?? 150);

$conn->begin_transaction();
try {
    $stmt = $conn->prepare('SELECT id FROM users WHERE email = ?');
    if (!$stmt) throw new Exception('Prepare failed for user lookup.');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user) throw new Exception('User not found.');
    $userId = (int)$user['id'];

    if ($transactionId > 0) {
        $stmt = $conn->prepare("SELECT id, book_id, borrowed_at, due_at, status FROM borrow_transactions WHERE id = ? AND user_id = ? AND action = 'BORROW' AND status IN ('ACTIVE','OVERDUE') LIMIT 1 FOR UPDATE");
        $stmt->bind_param('ii', $transactionId, $userId);
    } else {
        $stmt = $conn->prepare("SELECT id, book_id, borrowed_at, due_at, status FROM borrow_transactions WHERE user_id = ? AND book_id = ? AND action = 'BORROW' AND status IN ('ACTIVE','OVERDUE') LIMIT 1 FOR UPDATE");
        $stmt->bind_param('ii', $userId, $bookId);
    }
    if (!$stmt) throw new Exception('Prepare failed for transaction lookup.');
    $stmt->execute();
    $res = $stmt->get_result();
    $tx = $res->num_rows > 0 ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$tx) throw new Exception('Active borrow transaction not found.');

    $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');

    // compute overdue days and penalty
    $dueAt = $tx['due_at'] ?? null;
    $overdueDays = 0;
    if (!empty($dueAt)) {
        $due = new DateTimeImmutable($dueAt);
        $today = new DateTimeImmutable('today');
        if ($due < $today) {
            $overdueDays = (int)$due->diff($today)->format('%a');
        }
    }
    $chargeable = max(0, $overdueDays - $graceDays);
    $penaltyAmount = $chargeable * $dailyFee;

    // perform safe update using query to avoid bind type complexities
    $id = (int)$tx['id'];
    $od = (int)$overdueDays;
    $pa = number_format((float)$penaltyAmount, 2, '.', '');
    $nowEsc = $conn->real_escape_string($now);
    $updSql = "UPDATE borrow_transactions SET returned_at = '{$nowEsc}', status = 'COMPLETED', overdue_days = {$od}, penalty_amount = {$pa} WHERE id = {$id}";
    if ($conn->query($updSql) === false) throw new Exception('Failed to update borrow transaction.');

    // increment book availability
    $bookIdToUpdate = (int)$tx['book_id'];
    $availCol = null;
    $cols = $conn->query('SHOW COLUMNS FROM books');
    while ($row = $cols->fetch_assoc()) {
        $colsArr[$row['Field']] = true;
    }
    if (isset($colsArr['available'])) $availCol = 'available';
    elseif (isset($colsArr['copies_available'])) $availCol = 'copies_available';
    else $availCol = null;

    if ($availCol) {
        $stmt = $conn->prepare("UPDATE books SET {$availCol} = {$availCol} + 1 WHERE id = ?");
        if (!$stmt) throw new Exception('Prepare failed for book update.');
        $stmt->bind_param('i', $bookIdToUpdate);
        $stmt->execute();
        $stmt->close();
    }

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Book returned successfully.',
        'overdueDays' => $overdueDays,
        'penaltyAmount' => (float)$penaltyAmount
    ]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>
