<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, POST, OPTIONS');
header("Content-Type: application/json");

const STUDENT_ACTIVITY_FILE = __DIR__ . '/tmp/student_activity.log';
const STUDENT_ACTIVITY_LIMIT = 500;

// Try to load DB connection if available; fall back to file storage if not.
$has_db = false;
if (file_exists(__DIR__ . '/db.php')) {
    try {
        require_once __DIR__ . '/db.php';
        if (isset($conn) && $conn instanceof mysqli) {
            $has_db = true;
            // ensure table exists
            $conn->query("CREATE TABLE IF NOT EXISTS student_activities (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                action VARCHAR(120) NOT NULL,
                details TEXT NULL,
                event_time DATETIME NULL,
                event_ts BIGINT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_event_ts (event_ts),
                INDEX idx_event_ts_id (event_ts, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
        }
    } catch (Throwable $e) {
        $has_db = false;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // CORS preflight
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }

    $actor = requireAuthenticatedActor($data);

    $email = trim((string)($actor['email'] ?? ''));
    $action = trim($data['action'] ?? '');
    $details = $data['details'] ?? null;
    $time = $data['time'] ?? libraryIsoTimestamp();
    $timestamp = isset($data['timestamp']) ? (int)$data['timestamp'] : time();

    if ($email === '' || $action === '') {
        echo json_encode(['success' => false, 'message' => 'Missing email or action']);
        exit;
    }

    $entry = [
        'time' => $time,
        'timestamp' => $timestamp,
        'email' => $email,
        'action' => $action,
        'details' => $details
    ];
    if ($has_db) {
        $stmt = $conn->prepare('INSERT INTO student_activities (email, action, details, event_time, event_ts) VALUES (?, ?, ?, ?, ?)');
        $dt = null;
        if ($time) {
            // try to parse ISO 8601; fallback to null
            $ts = strtotime($time);
            if ($ts !== false) {
                $dt = date('Y-m-d H:i:s', $ts);
            }
        }
        $evt_ts = $timestamp ? (int)$timestamp : null;
        $stmt->bind_param('ssssi', $email, $action, $details, $dt, $evt_ts);
        $ok = $stmt->execute();
        if (!$ok) {
            // fallback to file if DB insert fails
            $dir = dirname(STUDENT_ACTIVITY_FILE);
            if (!is_dir($dir)) mkdir($dir, 0775, true);
            file_put_contents(STUDENT_ACTIVITY_FILE, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
        }
        $stmt->close();
        echo json_encode(['success' => true]);
        exit;
    }

    $dir = dirname(STUDENT_ACTIVITY_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    file_put_contents(STUDENT_ACTIVITY_FILE, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);

    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

requireAdminActor($_GET);

if ($has_db) {
    // query recent activities from DB
    $limit = STUDENT_ACTIVITY_LIMIT;
    $sql = "SELECT email, action, details, event_time AS time, event_ts AS timestamp FROM student_activities ORDER BY event_ts DESC, id DESC LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $limit);
    $stmt->execute();
    $res = $stmt->get_result();
    $activities = [];
    while ($row = $res->fetch_assoc()) {
        $activities[] = [
            'email' => $row['email'],
            'action' => $row['action'],
            'details' => $row['details'],
            'time' => $row['time'],
            'timestamp' => $row['timestamp'] ? (int)$row['timestamp'] : null
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'activities' => $activities]);
    exit;
}

if (!file_exists(STUDENT_ACTIVITY_FILE)) {
    echo json_encode(['success' => true, 'activities' => []]);
    exit;
}

$raw = @file(STUDENT_ACTIVITY_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
if ($raw === false) {
    echo json_encode(['success' => false, 'message' => 'Unable to read activity store']);
    exit;
}

$slice = array_slice($raw, -STUDENT_ACTIVITY_LIMIT);
$entries = [];
for ($i = count($slice) - 1; $i >= 0; $i--) {
    $decoded = json_decode($slice[$i], true);
    if (is_array($decoded)) {
        $entries[] = $decoded;
    }
}

echo json_encode(['success' => true, 'activities' => $entries]);
?>
