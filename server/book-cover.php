<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/request_auth.php';
requireAdmin();
require_once __DIR__ . '/db.php';

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

function ensureCoverFolder() {
    $uploadDir = __DIR__ . '/uploads/book-covers';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    return $uploadDir;
}

function updateBookCoverUrl($conn, $bookId, $coverUrl) {
    $stmt = $conn->prepare("UPDATE books SET cover_image_url = ? WHERE id = ?");
    if (!$stmt) {
        return ["success" => false, "message" => "Prepare failed: " . $conn->error];
    }
    $stmt->bind_param("si", $coverUrl, $bookId);
    $ok = $stmt->execute();
    $error = $stmt->error;
    $stmt->close();
    if (!$ok) {
        return ["success" => false, "message" => "Failed to update book cover: " . $error];
    }
    return ["success" => true];
}

function findBook($conn, $bookId) {
    $stmt = $conn->prepare("SELECT id FROM books WHERE id = ? LIMIT 1");
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

if (!ensureCoverColumn($conn)) {
    echo json_encode(["success" => false, "message" => "Failed to prepare cover column in books table"]);
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

if (!isset($_FILES['cover_image'])) {
    echo json_encode(["success" => false, "message" => "No cover image uploaded"]);
    $conn->close();
    exit;
}

$file = $_FILES['cover_image'];
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

$uploadDir = ensureCoverFolder();
$baseUrl = buildBaseUrl();
$filename = 'book-cover-' . $bookId . '-' . time() . '.' . $extension;
$targetPath = $uploadDir . '/' . $filename;
$moved = @move_uploaded_file($file['tmp_name'], $targetPath);

if (!$moved) {
    echo json_encode(["success" => false, "message" => "Failed to save uploaded file"]);
    $conn->close();
    exit;
}

// Tighten permissions on saved file
@chmod($targetPath, 0644);

$coverUrl = $baseUrl . '/uploads/book-covers/' . $filename;
$saveResult = updateBookCoverUrl($conn, $bookId, $coverUrl);
if (!$saveResult["success"]) {
    echo json_encode($saveResult);
    $conn->close();
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "Book cover uploaded successfully",
    "cover_image_url" => $coverUrl
]);

$conn->close();
?>
