<?php
require_once __DIR__ . '/request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
header("Content-Type: application/json");
requireAdmin();

const SECURITY_AUDIT_LOG_FILE = __DIR__ . '/tmp/security_audit.log';
const SECURITY_LOG_LIMIT = 120;

// Try to use DB if available
$has_db = false;
if (file_exists(__DIR__ . '/db.php')) {
    try {
        require_once __DIR__ . '/db.php';
        if (isset($conn) && $conn instanceof mysqli) {
            $has_db = true;
            $conn->query("CREATE TABLE IF NOT EXISTS security_audit_logs (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                event_time DATETIME NULL,
                event_ts BIGINT NULL,
                event_key VARCHAR(120) NOT NULL,
                email_hash VARCHAR(255) NULL,
                ip VARCHAR(45) NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_event_ts (event_ts),
                INDEX idx_email_hash (email_hash),
                INDEX idx_event_ts_id (event_ts, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
        }
    } catch (Throwable $e) {
        $has_db = false;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

if ($has_db) {
    $limit = SECURITY_LOG_LIMIT;
    $sql = "SELECT
                logs.event_time AS time,
                logs.event_key AS event,
                logs.email_hash,
                logs.ip,
                logs.details,
                logs.event_ts AS timestamp,
                COALESCE(NULLIF(TRIM(CONCAT(users.first_name, ' ', users.last_name)), ''), users.email, 'Admin') AS admin_name
            FROM security_audit_logs logs
            LEFT JOIN users ON SHA2(LOWER(users.email), 256) = logs.email_hash
            ORDER BY logs.event_ts DESC, logs.id DESC
            LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $limit);
    $stmt->execute();
    $res = $stmt->get_result();
    $logs = [];
    while ($row = $res->fetch_assoc()) {
        $decodedDetails = null;
        if ($row['details']) {
            $decodedDetails = json_decode($row['details'], true);
        }
        $logs[] = [
            'time' => $row['time'],
            'event' => $row['event'],
            'admin_name' => $row['admin_name'] ?: 'Admin',
            'email_hash' => $row['email_hash'],
            'ip' => $row['ip'],
            'details' => $decodedDetails,
            'timestamp' => $row['timestamp'] ? (int)$row['timestamp'] : null
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'logs' => $logs]);
    exit;
}

if (!file_exists(SECURITY_AUDIT_LOG_FILE)) {
    echo json_encode(['success' => true, 'logs' => []]);
    exit;
}

$raw = @file(SECURITY_AUDIT_LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
if ($raw === false) {
    echo json_encode(['success' => false, 'message' => 'Unable to read security logs']);
    exit;
}

$slice = array_slice($raw, -SECURITY_LOG_LIMIT);
$entries = [];
for ($i = count($slice) - 1; $i >= 0; $i--) {
    $decoded = json_decode($slice[$i], true);
    if (is_array($decoded)) {
        $entries[] = $decoded;
    }
}

echo json_encode([
    'success' => true,
    'logs' => $entries
]);
?>
