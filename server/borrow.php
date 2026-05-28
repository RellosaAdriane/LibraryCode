<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/penalty_settings_store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Invalid request method"]);
    $conn->close();
    exit;
}

function ensureBorrowTransactionsTable($conn)
{
    $sql = "CREATE TABLE IF NOT EXISTS borrow_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        action ENUM('BORROW', 'RETURN') NOT NULL,
        borrowed_at DATETIME NULL,
        due_at DATETIME NULL,
        returned_at DATETIME NULL,
        status ENUM('ACTIVE', 'COMPLETED', 'OVERDUE') DEFAULT 'ACTIVE',
        grace_days INT NOT NULL DEFAULT 7,
        daily_fee DECIMAL(10,2) NOT NULL DEFAULT 150.00,
        overdue_days INT NOT NULL DEFAULT 0,
        penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_book_id (book_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_user_action_status_created (user_id, action, status, created_at),
        INDEX idx_user_book_action_status (user_id, book_id, action, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";

    return $conn->query($sql) === true;
}

function getBooksAvailabilityColumn($conn)
{
    $result = $conn->query("SHOW COLUMNS FROM books");
    if (!$result) {
        return null;
    }

    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $columns[$row['Field']] = true;
    }
    $result->free();

    if (isset($columns['available'])) {
        return 'available';
    }
    if (isset($columns['copies_available'])) {
        return 'copies_available';
    }

    return null;
}

function ensureBookArchiveColumn($conn)
{
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'archived_at'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    return $conn->query("ALTER TABLE books ADD COLUMN archived_at DATETIME NULL") === true;
}

function getMaxOverdueDays($conn, $userId)
{
    $stmt = $conn->prepare("SELECT due_at FROM borrow_transactions WHERE user_id = ? AND action = 'BORROW' AND status IN ('ACTIVE', 'OVERDUE') AND due_at IS NOT NULL");
    if (!$stmt) {
        return 0;
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $today = new DateTimeImmutable('today');
    $maxOverdueDays = 0;
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
    }

    $stmt->close();
    return $maxOverdueDays;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = [];
}
$actor = requireAuthenticatedActor($data);

$email = trim((string)($actor['email'] ?? ''));
$bookId = (int)($data['book_id'] ?? 0);
$dueDays = max(1, (int)($data['due_days'] ?? 14));

if ($bookId <= 0) {
    echo json_encode(["success" => false, "message" => "Book ID is required."]);
    $conn->close();
    exit;
}

if (!ensureBorrowTransactionsTable($conn)) {
    echo json_encode(["success" => false, "message" => "Failed to prepare borrow transactions table."]);
    $conn->close();
    exit;
}

if (!ensureBookArchiveColumn($conn)) {
    echo json_encode(["success" => false, "message" => "Failed to prepare books archive column."]);
    $conn->close();
    exit;
}

$availabilityColumn = getBooksAvailabilityColumn($conn);
if (!$availabilityColumn) {
    echo json_encode(["success" => false, "message" => "Books availability column not found."]);
    $conn->close();
    exit;
}

$penaltySettings = readPenaltySettings();
$graceDays = (int)($penaltySettings['grace_days'] ?? 7);
$dailyFee = (float)($penaltySettings['daily_fee'] ?? 150);
$blockOverdueDays = (int)($penaltySettings['block_overdue_days'] ?? 14);

$conn->begin_transaction();

try {
    $stmt = $conn->prepare('SELECT id FROM users WHERE email = ?');
    if (!$stmt) {
        throw new Exception('Prepare failed for user lookup.');
    }
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->num_rows > 0 ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user) {
        throw new Exception('User not found.');
    }

    $userId = (int)$user['id'];
    $maxOverdueDays = getMaxOverdueDays($conn, $userId);
    if ($maxOverdueDays >= $blockOverdueDays) {
        throw new Exception("Borrowing is blocked. You have an overdue book {$maxOverdueDays} days late. Please return it first.");
    }

    $stmt = $conn->prepare("SELECT id, title, {$availabilityColumn} as available FROM books WHERE id = ? AND archived_at IS NULL FOR UPDATE");
    if (!$stmt) {
        throw new Exception('Prepare failed for book lookup.');
    }
    $stmt->bind_param('i', $bookId);
    $stmt->execute();
    $result = $stmt->get_result();
    $book = $result->num_rows > 0 ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$book) {
        throw new Exception('Book not found.');
    }

    $available = (int)$book['available'];
    if ($available <= 0) {
        throw new Exception('Book is currently unavailable.');
    }

    $stmt = $conn->prepare("SELECT id FROM borrow_transactions WHERE user_id = ? AND book_id = ? AND action = 'BORROW' AND status IN ('ACTIVE', 'OVERDUE') LIMIT 1");
    if (!$stmt) {
        throw new Exception('Prepare failed for borrow check.');
    }
    $stmt->bind_param('ii', $userId, $bookId);
    $stmt->execute();
    $alreadyBorrowed = $stmt->get_result()->num_rows > 0;
    $stmt->close();

    if ($alreadyBorrowed) {
        throw new Exception('You already borrowed this book.');
    }

    $borrowedAt = formatLibraryDateTime();
    $dueAt = libraryNow()->modify("+{$dueDays} days")->format('Y-m-d H:i:s');

    $stmt = $conn->prepare("INSERT INTO borrow_transactions (user_id, book_id, action, borrowed_at, due_at, status, grace_days, daily_fee, overdue_days, penalty_amount) VALUES (?, ?, 'BORROW', ?, ?, 'ACTIVE', ?, ?, 0, 0)");
    if (!$stmt) {
        throw new Exception('Prepare failed for borrow insert.');
    }
    $stmt->bind_param('iissid', $userId, $bookId, $borrowedAt, $dueAt, $graceDays, $dailyFee);
    if (!$stmt->execute()) {
        throw new Exception('Failed to record borrow transaction.');
    }
    $transactionId = (int)$stmt->insert_id;
    $stmt->close();

    $stmt = $conn->prepare("UPDATE books SET {$availabilityColumn} = {$availabilityColumn} - 1 WHERE id = ? AND {$availabilityColumn} > 0");
    if (!$stmt) {
        throw new Exception('Prepare failed for book update.');
    }
    $stmt->bind_param('i', $bookId);
    $stmt->execute();
    if ($stmt->affected_rows <= 0) {
        $stmt->close();
        throw new Exception('Unable to update book availability.');
    }
    $stmt->close();

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Book borrowed successfully.',
        'borrowed' => [
            'id' => $transactionId,
            'bookId' => $bookId,
            'title' => $book['title'],
            'borrowDate' => formatLibraryDate($borrowedAt),
            'dueDate' => formatLibraryDate($dueAt),
            'status' => 'active'
        ],
        'available' => $available - 1
    ]);
} catch (Exception $error) {
    $conn->rollback();
    echo json_encode([
        'success' => false,
        'message' => $error->getMessage()
    ]);
}

$conn->close();
?>
