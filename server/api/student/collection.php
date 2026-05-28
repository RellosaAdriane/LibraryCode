<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, POST, DELETE, OPTIONS');
require_once __DIR__ . '/../../db.php';

function ensureStudentCollectionTable($conn)
{
    return $conn->query("CREATE TABLE IF NOT EXISTS student_collection (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        collection_type ENUM('favorite','notify') NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_student_collection (user_id, book_id, collection_type),
        INDEX idx_user_type (user_id, collection_type),
        CONSTRAINT student_collection_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT student_collection_book_fk FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci") === true;
}

function normalizeCollectionType($value)
{
    $type = strtolower(trim((string)$value));
    return in_array($type, ['favorite', 'notify'], true) ? $type : '';
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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = [];
}

$actor = requireAuthenticatedActor($method === 'GET' ? $_GET : $data);
$userId = (int)($actor['user_id'] ?? 0);

if (!ensureStudentCollectionTable($conn)) {
    echo json_encode(["success" => false, "message" => "Unable to prepare student collection."]);
    $conn->close();
    exit;
}

if (!ensureBookArchiveColumn($conn)) {
    echo json_encode(["success" => false, "message" => "Unable to prepare books archive column."]);
    $conn->close();
    exit;
}

if ($method === 'GET') {
    $type = normalizeCollectionType($_GET['type'] ?? '');
    $sql = "SELECT sc.book_id, sc.collection_type
            FROM student_collection sc
            INNER JOIN books b ON b.id = sc.book_id
            WHERE sc.user_id = ? AND b.archived_at IS NULL";
    if ($type !== '') {
        $sql .= " AND sc.collection_type = ?";
    }
    $sql .= " ORDER BY sc.created_at DESC";

    $stmt = $conn->prepare($sql);
    if ($type !== '') {
        $stmt->bind_param('is', $userId, $type);
    } else {
        $stmt->bind_param('i', $userId);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $items = ['favorite' => [], 'notify' => []];
    while ($row = $result->fetch_assoc()) {
        $items[$row['collection_type']][] = (int)$row['book_id'];
    }
    $stmt->close();

    echo json_encode(["success" => true, "data" => $items]);
    $conn->close();
    exit;
}

$bookId = (int)($data['book_id'] ?? 0);
$type = normalizeCollectionType($data['type'] ?? '');
if ($bookId <= 0 || $type === '') {
    echo json_encode(["success" => false, "message" => "Book ID and collection type are required."]);
    $conn->close();
    exit;
}

if ($method === 'POST') {
    $bookStmt = $conn->prepare("SELECT id FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1");
    $bookStmt->bind_param('i', $bookId);
    $bookStmt->execute();
    $bookExists = $bookStmt->get_result()->num_rows > 0;
    $bookStmt->close();
    if (!$bookExists) {
        echo json_encode(["success" => false, "message" => "Book not found."]);
        $conn->close();
        exit;
    }

    $stmt = $conn->prepare("INSERT IGNORE INTO student_collection (user_id, book_id, collection_type) VALUES (?, ?, ?)");
    $stmt->bind_param('iis', $userId, $bookId, $type);
    $ok = $stmt->execute();
    $stmt->close();
    echo json_encode(["success" => (bool)$ok, "message" => $ok ? "Saved." : "Unable to save."]);
    $conn->close();
    exit;
}

if ($method === 'DELETE') {
    $stmt = $conn->prepare("DELETE FROM student_collection WHERE user_id = ? AND book_id = ? AND collection_type = ?");
    $stmt->bind_param('iis', $userId, $bookId, $type);
    $ok = $stmt->execute();
    $stmt->close();
    echo json_encode(["success" => (bool)$ok, "message" => $ok ? "Removed." : "Unable to remove."]);
    $conn->close();
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method."]);
$conn->close();
?>
