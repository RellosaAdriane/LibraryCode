<?php
include 'db.php';
require_once __DIR__ . '/session_store.php';
require_once __DIR__ . '/request_auth.php';

handleCorsPreflightAndExitIfNeeded('GET, PUT, OPTIONS');
applyCorsPolicy('GET, PUT, OPTIONS');
header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $actor = resolveAuthenticatedActor($_GET);

    $sessionId = trim($_GET['session_id'] ?? '');
    if ($sessionId !== '') {
        if (!$actor) {
            $actor = resolveAuthenticatedActor(['session_id' => $sessionId]);
        }
        if (!$actor) {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "Authentication required."]);
            $conn->close();
            exit;
        }

        $session = findSessionById($sessionId);
        if (!$session) {
            echo json_encode(["success" => false, "active" => false, "message" => "Session not found."]);
            $conn->close();
            exit;
        }

        if (($actor['role'] ?? '') !== 'admin') {
            $actorUserId = (int)($actor['user_id'] ?? 0);
            if ($actorUserId <= 0 || $actorUserId !== (int)($session['user_id'] ?? 0)) {
                http_response_code(403);
                echo json_encode(["success" => false, "message" => "Access denied."]);
                $conn->close();
                exit;
            }
        }

        echo json_encode([
            "success" => true,
            "active" => empty($session['revoked_at']),
            "session" => $session
        ]);
        $conn->close();
        exit;
    }

    $actor = requireAuthenticatedActor($_GET);

    $targetUserId = intval($_GET['user_id'] ?? 0);
    if (($actor['role'] ?? '') !== 'admin') {
        $targetUserId = (int)$actor['user_id'];
    }

    $includeRevoked = ($_GET['include_revoked'] ?? '1') !== '0';
    $sessions = listSessions($targetUserId > 0 ? $targetUserId : null, $includeRevoked);

    echo json_encode([
        "success" => true,
        "sessions" => $sessions
    ]);
    $conn->close();
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        $data = [];
    }
    $action = trim(strtolower((string)($data['action'] ?? '')));

    if ($action === 'touch') {
        $sessionId = trim((string)($data['session_id'] ?? ''));
        if ($sessionId === '') {
            echo json_encode(["success" => false, "message" => "Session id is required."]);
            $conn->close();
            exit;
        }

        $actor = resolveAuthenticatedActor($data);
        if (!$actor) {
            $actor = resolveAuthenticatedActor(['session_id' => $sessionId]);
        }
        if (!$actor) {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "Authentication required."]);
            $conn->close();
            exit;
        }

        if (($actor['role'] ?? '') !== 'admin' && ($actor['id'] ?? '') !== $sessionId) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Access denied."]);
            $conn->close();
            exit;
        }

        $updated = touchSession($sessionId);
        if (!$updated) {
            echo json_encode(["success" => false, "message" => "Session not found."]);
            $conn->close();
            exit;
        }

        echo json_encode(["success" => true, "session" => $updated]);
        $conn->close();
        exit;
    }

    if ($action === 'revoke') {
        $actor = requireAuthenticatedActor($data);
        $sessionId = trim((string)($data['session_id'] ?? ''));
        if ($sessionId === '') {
            echo json_encode(["success" => false, "message" => "Session id is required."]);
            $conn->close();
            exit;
        }

        $session = findSessionById($sessionId);
        if (!$session) {
            echo json_encode(["success" => false, "message" => "Session not found."]);
            $conn->close();
            exit;
        }

        if (($actor['role'] ?? '') !== 'admin') {
            $actorUserId = (int)($actor['user_id'] ?? 0);
            if ($actorUserId <= 0 || $actorUserId !== (int)($session['user_id'] ?? 0)) {
                http_response_code(403);
                echo json_encode(["success" => false, "message" => "Access denied."]);
                $conn->close();
                exit;
            }
        }

        $updated = revokeSession($sessionId, 'revoked_by_request');
        if (!$updated) {
            echo json_encode(["success" => false, "message" => "Unable to revoke session."]);
            $conn->close();
            exit;
        }

        echo json_encode(["success" => true, "message" => "Session revoked.", "session" => $updated]);
        $conn->close();
        exit;
    }

    echo json_encode(["success" => false, "message" => "Invalid action."]);
    $conn->close();
    exit;
}

echo json_encode(["success" => false, "message" => "Invalid request method"]);
$conn->close();
?>
