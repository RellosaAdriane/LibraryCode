<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('POST, OPTIONS');
header("Content-Type: application/json");
requireAdmin();
require_once __DIR__ . '/db.php';

function getBookInventoryAvailableColumn($conn) {
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

    return 'id';
}

function ensureQrColumn($conn) {
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'qr_image_url'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    $afterColumn = getBookInventoryAvailableColumn($conn);
    return $conn->query("ALTER TABLE books ADD COLUMN qr_image_url VARCHAR(500) NULL AFTER {$afterColumn}") === true;
}

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

function buildBaseUrl() {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $scheme = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return $scheme . '://' . $host . $scriptDir;
}

function ensureQrFolder() {
    $uploadDir = __DIR__ . '/uploads/book-qr';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    return $uploadDir;
}

function updateBookQrUrl($conn, $bookId, $qrUrl) {
    $stmt = $conn->prepare("UPDATE books SET qr_image_url = ? WHERE id = ?");
    if (!$stmt) {
        return ["success" => false, "message" => "Prepare failed: " . $conn->error];
    }
    $stmt->bind_param("si", $qrUrl, $bookId);
    $ok = $stmt->execute();
    $error = $stmt->error;
    $stmt->close();
    if (!$ok) {
        return ["success" => false, "message" => "Failed to update book QR: " . $error];
    }
    return ["success" => true];
}

function findBook($conn, $bookId) {
    $stmt = $conn->prepare("SELECT id, title, isbn FROM books WHERE id = ? LIMIT 1");
    if (!$stmt) {
        return [null, "Prepare failed: " . $conn->error];
    }
    $stmt->bind_param("i", $bookId);
    $stmt->execute();
    $result = $stmt->get_result();
    $book = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return [$book, null];
}

$bookId = intval($_POST['book_id'] ?? 0);
$action = trim($_POST['action'] ?? 'upload');

if (!ensureQrColumn($conn)) {
    echo json_encode(["success" => false, "message" => "Failed to prepare QR column in books table"]);
    $conn->close();
    exit;
}

if ($bookId <= 0) {
    echo json_encode(["success" => false, "message" => "Valid book_id is required"]);
    $conn->close();
    exit;
}

list($book, $bookError) = findBook($conn, $bookId);
if ($bookError) {
    echo json_encode(["success" => false, "message" => $bookError]);
    $conn->close();
    exit;
}
if (!$book) {
    echo json_encode(["success" => false, "message" => "Book not found"]);
    $conn->close();
    exit;
}

$uploadDir = ensureQrFolder();
$baseUrl = buildBaseUrl();

if ($action === 'generate') {
    $payloadParts = [
        'BOOK',
        strval($book['id']),
        trim($book['isbn'] ?? ''),
        trim($book['title'] ?? '')
    ];
    $payload = implode('|', array_filter($payloadParts, function ($part) {
        return $part !== '';
    }));

    $qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' . rawurlencode($payload);
    $qrImage = @file_get_contents($qrApiUrl);

    if ($qrImage === false || strlen($qrImage) === 0) {
        echo json_encode(["success" => false, "message" => "Failed to generate QR image"]);
        $conn->close();
        exit;
    }

    $filename = 'book-' . $bookId . '-' . time() . '.png';
    $targetPath = $uploadDir . '/' . $filename;
    $writeOk = @file_put_contents($targetPath, $qrImage);

    if ($writeOk === false) {
        echo json_encode(["success" => false, "message" => "Failed to save generated QR image"]);
        $conn->close();
        exit;
    }

    $qrUrl = $baseUrl . '/uploads/book-qr/' . $filename;
    $saveResult = updateBookQrUrl($conn, $bookId, $qrUrl);
    if (!$saveResult["success"]) {
        echo json_encode($saveResult);
        $conn->close();
        exit;
    }

    echo json_encode([
        "success" => true,
        "message" => "QR generated successfully",
        "qr_image_url" => $qrUrl
    ]);
    $conn->close();
    exit;
}

if (!isset($_FILES['qr_image'])) {
    echo json_encode(["success" => false, "message" => "No QR image uploaded"]);
    $conn->close();
    exit;
}

$file = $_FILES['qr_image'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    echo json_encode(["success" => false, "message" => "File upload failed"]);
    $conn->close();
    exit;
}

$maxSize = 5 * 1024 * 1024;
if (($file['size'] ?? 0) > $maxSize) {
    echo json_encode(["success" => false, "message" => "File too large. Max 5MB"]);
    $conn->close();
    exit;
}

$allowedExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
$originalName = strval($file['name'] ?? '');
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExt, true)) {
    echo json_encode(["success" => false, "message" => "Invalid file type. Allowed: PNG, JPG, JPEG, WEBP, SVG"]);
    $conn->close();
    exit;
}

// MIME type validation (extra safety)
$finfo = null;
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    $allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!in_array($mime, $allowedMimes, true)) {
        if ($finfo) finfo_close($finfo);
        echo json_encode(["success" => false, "message" => "Invalid MIME type: " . ($mime ?? 'unknown')]);
        $conn->close();
        exit;
    }
    if ($finfo) finfo_close($finfo);
}

$filename = 'book-' . $bookId . '-' . time() . '.' . $extension;
$targetPath = $uploadDir . '/' . $filename;
$moved = @move_uploaded_file($file['tmp_name'], $targetPath);

if (!$moved) {
    echo json_encode(["success" => false, "message" => "Failed to save uploaded file"]);
    $conn->close();
    exit;
}

// Tighten permissions on saved file
@chmod($targetPath, 0644);

$qrUrl = $baseUrl . '/uploads/book-qr/' . $filename;
$saveResult = updateBookQrUrl($conn, $bookId, $qrUrl);
if (!$saveResult["success"]) {
    echo json_encode($saveResult);
    $conn->close();
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "QR uploaded successfully",
    "qr_image_url" => $qrUrl
]);

$conn->close();
?>
