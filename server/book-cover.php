<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, HEAD, POST, OPTIONS');

if (in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) {
    serveCoverFileFromRequest();
    exit;
}

header("Content-Type: application/json");
requireAdmin();
require_once __DIR__ . '/db.php';

function getCoverColumnAnchor($conn) {
    $result = $conn->query("SHOW COLUMNS FROM books");
    if (!$result) {
        return 'id';
    }

    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $columns[$row['Field']] = true;
    }
    $result->free();

    if (isset($columns['qr_image_url'])) {
        return 'qr_image_url';
    }
    if (isset($columns['copies_available'])) {
        return 'copies_available';
    }
    if (isset($columns['available'])) {
        return 'available';
    }

    return 'id';
}

function ensureCoverColumn($conn) {
    $check = $conn->query("SHOW COLUMNS FROM books LIKE 'cover_image_url'");
    if (!$check) {
        return false;
    }
    if ($check->num_rows > 0) {
        return true;
    }
    $afterColumn = getCoverColumnAnchor($conn);
    return $conn->query("ALTER TABLE books ADD COLUMN cover_image_url VARCHAR(500) NULL AFTER {$afterColumn}") === true;
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

function ensureCoverFolder($requireWritable = true) {
    $uploadDir = __DIR__ . '/uploads/book-covers';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }
    if (!is_dir($uploadDir) || ($requireWritable && !is_writable($uploadDir))) {
        return null;
    }
    return $uploadDir;
}

function getCoverMimeType($extension) {
    $types = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml'
    ];

    return $types[$extension] ?? 'application/octet-stream';
}

function serveCoverFileFromRequest() {
    $filename = basename(strval($_GET['file'] ?? ''));

    if (!preg_match('/^book-cover-\d+-\d+\.(png|jpg|jpeg|webp|svg)$/i', $filename, $matches)) {
        jsonResponseAndExit(404, ["success" => false, "message" => "Cover image not found"]);
    }

    $uploadDir = ensureCoverFolder(false);
    $targetPath = $uploadDir ? $uploadDir . '/' . $filename : '';
    if ($targetPath === '' || !is_file($targetPath) || !is_readable($targetPath)) {
        jsonResponseAndExit(404, ["success" => false, "message" => "Cover image not found"]);
    }

    header('Content-Type: ' . getCoverMimeType(strtolower($matches[1])));
    header('Content-Length: ' . filesize($targetPath));
    header('Cache-Control: public, max-age=31536000, immutable');
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        return;
    }
    readfile($targetPath);
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
if (!$uploadDir) {
    echo json_encode(["success" => false, "message" => "Cover upload folder is not writable"]);
    $conn->close();
    exit;
}
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

$coverUrl = $baseUrl . '/book-cover.php?file=' . rawurlencode($filename);
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
