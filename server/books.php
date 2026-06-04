<?php
include 'db.php';
require_once __DIR__ . '/request_auth.php';

handleCorsPreflightAndExitIfNeeded('GET, POST, PUT, DELETE, OPTIONS');
applyCorsPolicy('GET, POST, PUT, DELETE, OPTIONS');
header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];

function getBookInventoryColumns($conn) {
    $result = $conn->query("SHOW COLUMNS FROM books");
    if (!$result) {
        return null;
    }

    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $columns[$row['Field']] = true;
    }
    $result->free();

    if (isset($columns['quantity']) && isset($columns['available'])) {
        return ['total' => 'quantity', 'available' => 'available'];
    }
    if (isset($columns['copies_total']) && isset($columns['copies_available'])) {
        return ['total' => 'copies_total', 'available' => 'copies_available'];
    }

    return null;
}

function ensureQrColumn($conn) {
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'qr_image_url'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    $inventoryColumns = getBookInventoryColumns($conn);
    $afterColumn = $inventoryColumns ? $inventoryColumns['available'] : 'id';
    return $conn->query("ALTER TABLE books ADD COLUMN qr_image_url VARCHAR(500) NULL AFTER {$afterColumn}") === true;
}

function ensureCoverColumn($conn) {
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'cover_image_url'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    return $conn->query("ALTER TABLE books ADD COLUMN cover_image_url VARCHAR(500) NULL AFTER qr_image_url") === true;
}

function ensureIntroColumn($conn) {
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'intro'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    return $conn->query("ALTER TABLE books ADD COLUMN intro TEXT NULL AFTER cover_image_url") === true;
}

function ensureBookArchiveColumn($conn) {
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'archived_at'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    return $conn->query("ALTER TABLE books ADD COLUMN archived_at DATETIME NULL AFTER intro") === true;
}

function hasBorrowTransactionsTable($conn) {
    $check = $conn->query("SHOW TABLES LIKE 'borrow_transactions'");
    return $check && $check->num_rows > 0;
}

if ($method === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    $conn->close();
    exit;
}

switch ($method) {
    case 'GET':
        if (!ensureQrColumn($conn) || !ensureCoverColumn($conn) || !ensureIntroColumn($conn) || !ensureBookArchiveColumn($conn)) {
            echo json_encode(["success" => false, "message" => "Failed to prepare books table columns"]);
            break;
        }
        // Get all books with lightweight catalog metadata.
        if (hasBorrowTransactionsTable($conn)) {
            $result = $conn->query(
                "SELECT b.*, COALESCE(stats.borrow_count, 0) AS borrow_count
                 FROM books b
                 LEFT JOIN (
                    SELECT book_id, COUNT(*) AS borrow_count
                    FROM borrow_transactions
                    WHERE action = 'BORROW'
                    GROUP BY book_id
                 ) stats ON stats.book_id = b.id
                 WHERE b.archived_at IS NULL
                 ORDER BY b.title"
            );
        } else {
            $result = $conn->query("SELECT b.*, 0 AS borrow_count FROM books b WHERE b.archived_at IS NULL ORDER BY b.title");
        }
        if (!$result) {
            echo json_encode(["success" => false, "message" => "Database error: " . $conn->error]);
            break;
        }
        $books = [];
        
        while ($row = $result->fetch_assoc()) {
            $books[] = $row;
        }
        
        echo json_encode(["success" => true, "books" => $books]);
        break;

    case 'POST':
        if (!ensureQrColumn($conn) || !ensureCoverColumn($conn) || !ensureIntroColumn($conn) || !ensureBookArchiveColumn($conn)) {
            echo json_encode(["success" => false, "message" => "Failed to prepare books table columns"]);
            break;
        }
        // Add new book (admin only)
        $data = json_decode(file_get_contents("php://input"), true);
        if (!is_array($data)) {
            $data = [];
        }
        $adminActor = requireAdminActor($data);

        $title = trim($data['title'] ?? '');
        $author = trim($data['author'] ?? '');
        $isbn = trim($data['isbn'] ?? '');
        $category = trim($data['category'] ?? '');
        $quantity = max(0, intval($data['quantity'] ?? 1));
        $qrImageUrl = trim($data['qr_image_url'] ?? '');
        $coverImageUrl = trim($data['cover_image_url'] ?? '');
        $intro = trim($data['intro'] ?? '');
        $inventoryColumns = getBookInventoryColumns($conn);
        
        if (empty($title) || empty($author)) {
            echo json_encode(["success" => false, "message" => "Title and author are required"]);
            break;
        }

        if (!$inventoryColumns) {
            echo json_encode(["success" => false, "message" => "Books inventory columns not found"]);
            break;
        }
        
        $totalColumn = $inventoryColumns['total'];
        $availableColumn = $inventoryColumns['available'];
        $stmt = $conn->prepare("INSERT INTO books (title, author, isbn, category, {$totalColumn}, {$availableColumn}, qr_image_url, cover_image_url, intro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
            break;
        }
        $stmt->bind_param("ssssiisss", $title, $author, $isbn, $category, $quantity, $quantity, $qrImageUrl, $coverImageUrl, $intro);
        
        if ($stmt->execute()) {
                $newId = intval($conn->insert_id);
                echo json_encode([
                    "success" => true,
                    "message" => "Book added successfully",
                    "id" => $newId
                ]);
                // Log admin action
                $emailHash = hash('sha256', strtolower($adminActor['email'] ?? ''));
                $details = json_encode(['book_id' => $newId, 'title' => $title]);
                $event_ts = round(microtime(true) * 1000);
                $ip = $_SERVER['REMOTE_ADDR'] ?? '';
                if (isset($conn) && $conn instanceof mysqli) {
                    try {
                        $stmt2 = $conn->prepare('INSERT INTO security_audit_logs (event_time, event_ts, event_key, email_hash, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
                        $et = formatLibraryDateTime();
                        $event_key = 'book_added';
                        $hashVal = $emailHash ?? null;
                        $stmt2->bind_param('sissss', $et, $event_ts, $event_key, $hashVal, $ip, $details);
                        $stmt2->execute();
                        $stmt2->close();
                    } catch (Throwable $e) {
                        file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'book_added', 'email_hash' => $emailHash, 'ip' => $ip, 'details' => ['book_id' => $newId, 'title' => $title]]) . PHP_EOL, FILE_APPEND | LOCK_EX);
                    }
                } else {
                    file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'book_added', 'email_hash' => $emailHash, 'ip' => $ip, 'details' => ['book_id' => $newId, 'title' => $title]]) . PHP_EOL, FILE_APPEND | LOCK_EX);
                }
        } else {
            echo json_encode(["success" => false, "message" => "Failed to add book: " . $stmt->error]);
        }
        
        $stmt->close();
        break;

    case 'PUT':
        if (!ensureQrColumn($conn) || !ensureCoverColumn($conn) || !ensureIntroColumn($conn) || !ensureBookArchiveColumn($conn)) {
            echo json_encode(["success" => false, "message" => "Failed to prepare books table columns"]);
            break;
        }
        // Update book (admin only)
        $data = json_decode(file_get_contents("php://input"), true);
        if (!is_array($data)) {
            $data = [];
        }
        $adminActor = requireAdminActor($data);

        $id = intval($data['id'] ?? 0);
        $title = trim($data['title'] ?? '');
        $author = trim($data['author'] ?? '');
        $isbn = trim($data['isbn'] ?? '');
        $category = trim($data['category'] ?? '');
        $quantity = max(0, intval($data['quantity'] ?? 1));
        $qrImageUrlProvided = array_key_exists('qr_image_url', $data);
        $qrImageUrl = trim($data['qr_image_url'] ?? '');
        $coverImageUrlProvided = array_key_exists('cover_image_url', $data);
        $coverImageUrl = trim($data['cover_image_url'] ?? '');
        $intro = trim($data['intro'] ?? '');
        $inventoryColumns = getBookInventoryColumns($conn);

        if (!$inventoryColumns) {
            echo json_encode(["success" => false, "message" => "Books inventory columns not found"]);
            break;
        }

        $totalColumn = $inventoryColumns['total'];
        $availableColumn = $inventoryColumns['available'];
        $currentStmt = $conn->prepare("SELECT {$totalColumn} AS total_copies, {$availableColumn} AS available_copies FROM books WHERE id = ?");
        if (!$currentStmt) {
            echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
            break;
        }
        $currentStmt->bind_param("i", $id);
        $currentStmt->execute();
        $currentResult = $currentStmt->get_result();
        $currentBook = $currentResult ? $currentResult->fetch_assoc() : null;
        $currentStmt->close();

        if (!$currentBook) {
            echo json_encode(["success" => false, "message" => "Book not found"]);
            break;
        }

        $currentTotal = max(0, (int)($currentBook['total_copies'] ?? 0));
        $currentAvailable = max(0, (int)($currentBook['available_copies'] ?? 0));
        $checkedOut = max(0, $currentTotal - $currentAvailable);
        $nextAvailable = max(0, $quantity - $checkedOut);

        if ($qrImageUrlProvided && $coverImageUrlProvided) {
            $stmt = $conn->prepare("UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, {$totalColumn} = ?, {$availableColumn} = ?, qr_image_url = ?, cover_image_url = ?, intro = ? WHERE id = ?");
        } else if ($qrImageUrlProvided) {
            $stmt = $conn->prepare("UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, {$totalColumn} = ?, {$availableColumn} = ?, qr_image_url = ?, intro = ? WHERE id = ?");
        } else if ($coverImageUrlProvided) {
            $stmt = $conn->prepare("UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, {$totalColumn} = ?, {$availableColumn} = ?, cover_image_url = ?, intro = ? WHERE id = ?");
        } else {
            $stmt = $conn->prepare("UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, {$totalColumn} = ?, {$availableColumn} = ?, intro = ? WHERE id = ?");
        }
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
            break;
        }
        if ($qrImageUrlProvided && $coverImageUrlProvided) {
            $stmt->bind_param("ssssiisssi", $title, $author, $isbn, $category, $quantity, $nextAvailable, $qrImageUrl, $coverImageUrl, $intro, $id);
        } else if ($qrImageUrlProvided) {
            $stmt->bind_param("ssssiissi", $title, $author, $isbn, $category, $quantity, $nextAvailable, $qrImageUrl, $intro, $id);
        } else if ($coverImageUrlProvided) {
            $stmt->bind_param("ssssiissi", $title, $author, $isbn, $category, $quantity, $nextAvailable, $coverImageUrl, $intro, $id);
        } else {
            $stmt->bind_param("ssssiisi", $title, $author, $isbn, $category, $quantity, $nextAvailable, $intro, $id);
        }
        
        if ($stmt->execute()) {
            echo json_encode(["success" => true, "message" => "Book updated successfully"]);
            // Log admin update
            $emailHash = hash('sha256', strtolower($adminActor['email'] ?? ''));
            $details = json_encode(['book_id' => $id, 'title' => $title]);
            $event_ts = round(microtime(true) * 1000);
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';
            if (isset($conn) && $conn instanceof mysqli) {
                try {
                    $stmt2 = $conn->prepare('INSERT INTO security_audit_logs (event_time, event_ts, event_key, email_hash, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
                    $et = formatLibraryDateTime();
                    $event_key = 'book_updated';
                    $hashVal = $emailHash ?? null;
                    $stmt2->bind_param('sissss', $et, $event_ts, $event_key, $hashVal, $ip, $details);
                    $stmt2->execute();
                    $stmt2->close();
                } catch (Throwable $e) {
                    file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'book_updated', 'email_hash' => $emailHash, 'ip' => $ip, 'details' => ['book_id' => $id, 'title' => $title]]) . PHP_EOL, FILE_APPEND | LOCK_EX);
                }
            } else {
                file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'book_updated', 'email_hash' => $emailHash, 'ip' => $ip, 'details' => ['book_id' => $id, 'title' => $title]]) . PHP_EOL, FILE_APPEND | LOCK_EX);
            }
        } else {
            echo json_encode(["success" => false, "message" => "Failed to update book: " . $stmt->error]);
        }
        
        $stmt->close();
        break;

    case 'DELETE':
        // Archive book (admin only). Archived books stay in the database and keep media files.
        $adminActor = requireAdminActor($_GET);
        $id = intval($_GET['id'] ?? 0);

        if (!ensureQrColumn($conn) || !ensureCoverColumn($conn) || !ensureIntroColumn($conn) || !ensureBookArchiveColumn($conn)) {
            echo json_encode(["success" => false, "message" => "Failed to prepare books table columns"]);
            break;
        }

        if ($id <= 0) {
            echo json_encode(["success" => false, "message" => "Valid book id is required"]);
            break;
        }

        $bookStmt = $conn->prepare("SELECT title, archived_at FROM books WHERE id = ? LIMIT 1");
        if (!$bookStmt) {
            echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
            break;
        }
        $bookStmt->bind_param("i", $id);
        $bookStmt->execute();
        $bookResult = $bookStmt->get_result();
        $book = $bookResult ? $bookResult->fetch_assoc() : null;
        $bookStmt->close();

        if (!$book) {
            echo json_encode(["success" => false, "message" => "Book not found"]);
            break;
        }

        if (!empty($book['archived_at'])) {
            echo json_encode(["success" => true, "message" => "Book is already archived"]);
            break;
        }
        
        $stmt = $conn->prepare("UPDATE books SET archived_at = NOW() WHERE id = ? AND archived_at IS NULL");
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
            break;
        }
        $stmt->bind_param("i", $id);
        
        if ($stmt->execute() && $stmt->affected_rows > 0) {
            echo json_encode(["success" => true, "message" => "Book archived successfully"]);
            // Log admin archive
            $emailHash = hash('sha256', strtolower($adminActor['email'] ?? ''));
            $details = json_encode(['book_id' => $id, 'title' => $book['title'] ?? '']);
            $event_ts = round(microtime(true) * 1000);
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';
            if (isset($conn) && $conn instanceof mysqli) {
                try {
                    $stmt2 = $conn->prepare('INSERT INTO security_audit_logs (event_time, event_ts, event_key, email_hash, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
                    $et = formatLibraryDateTime();
                    $event_key = 'book_archived';
                    $hashVal = $emailHash ?? null;
                    $stmt2->bind_param('sissss', $et, $event_ts, $event_key, $hashVal, $ip, $details);
                    $stmt2->execute();
                    $stmt2->close();
                } catch (Throwable $e) {
                    file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'book_archived', 'email_hash' => $emailHash, 'ip' => $ip, 'details' => ['book_id' => $id, 'title' => $book['title'] ?? '']]) . PHP_EOL, FILE_APPEND | LOCK_EX);
                }
            } else {
                file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'book_archived', 'email_hash' => $emailHash, 'ip' => $ip, 'details' => ['book_id' => $id, 'title' => $book['title'] ?? '']]) . PHP_EOL, FILE_APPEND | LOCK_EX);
            }
        } else if ($stmt->error) {
            echo json_encode(["success" => false, "message" => "Failed to archive book: " . $stmt->error]);
        } else {
            echo json_encode(["success" => false, "message" => "Book not found"]);
        }
        
        $stmt->close();
        break;

    default:
        echo json_encode(["success" => false, "message" => "Invalid request method"]);
        break;
}

$conn->close();
?>
