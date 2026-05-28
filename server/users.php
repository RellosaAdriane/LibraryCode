<?php
include 'db.php';
require_once __DIR__ . '/request_auth.php';

handleCorsPreflightAndExitIfNeeded('GET, PUT, OPTIONS');
applyCorsPolicy('GET, PUT, OPTIONS');
header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $adminActor = requireAdminActor($_GET);

        $result = $conn->query("SELECT id, first_name, last_name, email, role, affiliation, institution_id, created_at FROM users ORDER BY created_at DESC");
        if (!$result) {
            echo json_encode(["success" => false, "message" => "Database error: " . $conn->error]);
            break;
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }

        echo json_encode(["success" => true, "users" => $users]);
        break;

    case 'PUT':
        $data = json_decode(file_get_contents("php://input"), true);
        if (!is_array($data)) {
            $data = [];
        }
        $adminActor = requireAdminActor($data);

        $id = intval($data['id'] ?? 0);
        $role = trim(strtolower($data['role'] ?? ''));
        $allowedRoles = ['student', 'admin'];

        if ($id <= 0 || !in_array($role, $allowedRoles, true)) {
            echo json_encode(["success" => false, "message" => "Invalid user id or role."]);
            break;
        }

        $requesterId = intval($adminActor['user_id'] ?? $adminActor['id'] ?? 0);
        if ($requesterId > 0 && $id === $requesterId && $role !== 'admin') {
            echo json_encode(["success" => false, "message" => "You cannot remove your own admin access."]);
            break;
        }

        $stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
            break;
        }

        $stmt->bind_param("si", $role, $id);

        if ($stmt->execute()) {
            echo json_encode(["success" => true, "message" => "User role updated."]);
            // Log admin action to security_audit_logs if DB available, otherwise append to file
            $emailHash = hash('sha256', strtolower($adminActor['email'] ?? ''));
            $details = json_encode(['target_user_id' => $id, 'new_role' => $role]);
            $event_ts = round(microtime(true) * 1000);
            if (isset($conn) && $conn instanceof mysqli) {
                try {
                    $stmt2 = $conn->prepare('INSERT INTO security_audit_logs (event_time, event_ts, event_key, email_hash, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
                    $et = date('Y-m-d H:i:s');
                    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
                    $event_key = 'user_role_updated';
                    $stmt2->bind_param('sissss', $et, $event_ts, $event_key, $emailHash, $ip, $details);
                    $stmt2->execute();
                    $stmt2->close();
                } catch (Throwable $e) {
                    file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'user_role_updated', 'email_hash' => $emailHash, 'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'details' => ['target_user_id' => $id, 'new_role' => $role]]) . PHP_EOL, FILE_APPEND | LOCK_EX);
                }
            } else {
                file_put_contents(__DIR__ . '/tmp/security_audit.log', json_encode(['time' => libraryIsoTimestamp(), 'event' => 'user_role_updated', 'email_hash' => $emailHash, 'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'details' => ['target_user_id' => $id, 'new_role' => $role]]) . PHP_EOL, FILE_APPEND | LOCK_EX);
            }
        } else {
            echo json_encode(["success" => false, "message" => "Failed to update role: " . $stmt->error]);
        }

        $stmt->close();
        break;

    default:
        echo json_encode(["success" => false, "message" => "Invalid request method"]);
        break;
}

$conn->close();
?>