<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
header('Content-Type: application/json');
require_once __DIR__ . '/../../db.php';

$actor = requireAuthenticatedActor($_GET);
$email = trim((string)($actor['email'] ?? ''));

if ($email === '') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required']);
    exit;
}

$limit = 30;
if (isset($_GET['limit'])) {
    $requestedLimit = (int)$_GET['limit'];
    if ($requestedLimit > 0 && $requestedLimit <= 100) {
        $limit = $requestedLimit;
    }
}

$tableCheck = $conn->query("SHOW TABLES LIKE 'student_activities'");
if (!$tableCheck || $tableCheck->num_rows === 0) {
    echo json_encode(['success' => true, 'activities' => []]);
    $conn->close();
    exit;
}

$stmt = $conn->prepare(
    'SELECT action, details, event_time AS time, event_ts AS timestamp
     FROM student_activities
     WHERE email = ?
     ORDER BY event_ts DESC, id DESC
     LIMIT ?'
);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load activity']);
    $conn->close();
    exit;
}

$stmt->bind_param('si', $email, $limit);
$stmt->execute();
$result = $stmt->get_result();

$activities = [];
while ($row = $result->fetch_assoc()) {
    $activities[] = [
        'action' => $row['action'] ?? 'Activity',
        'details' => $row['details'] ?? null,
        'time' => $row['time'] ?? null,
        'timestamp' => isset($row['timestamp']) ? (int)$row['timestamp'] : null,
    ];
}

$stmt->close();
$conn->close();

echo json_encode(['success' => true, 'activities' => $activities]);
