<?php
require_once __DIR__ . '/../../request_auth.php';
handleCorsPreflightAndExitIfNeeded('GET, OPTIONS');
applyCorsPolicy('GET, OPTIONS');
header('Content-Type: application/json');
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../sync_helpers.php';

$actor = resolveAuthenticatedActor($_GET);
$parts = [
    syncBooksRevision($conn),
    ...syncSettingsFileRevisions(),
];

if ($actor) {
    $userId = (int)($actor['user_id'] ?? 0);
    $email = trim((string)($actor['email'] ?? ''));

    if ($userId > 0) {
        $parts[] = syncTableRevision(
            $conn,
            'borrow_transactions',
            "SELECT COUNT(*) AS row_count,
                    COALESCE(MAX(id), 0) AS max_id,
                    COALESCE(MAX(borrowed_at), '') AS max_borrowed,
                    COALESCE(MAX(returned_at), '') AS max_returned,
                    COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_count,
                    COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END), 0) AS overdue_count,
                    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_count
             FROM borrow_transactions
             WHERE user_id = {$userId}"
        );

        $parts[] = syncTableRevision(
            $conn,
            'student_collection',
            "SELECT COUNT(*) AS row_count,
                    COALESCE(MAX(id), 0) AS max_id,
                    COALESCE(MAX(created_at), '') AS max_created
             FROM student_collection
             WHERE user_id = {$userId}"
        );
    }

    if ($email !== '') {
        $escapedEmail = $conn->real_escape_string($email);
        $parts[] = syncTableRevision(
            $conn,
            'student_activities',
            "SELECT COUNT(*) AS row_count,
                    COALESCE(MAX(id), 0) AS max_id,
                    COALESCE(MAX(created_at), '') AS max_created
             FROM student_activities
             WHERE email = '{$escapedEmail}'"
        );
    }
}

echo json_encode([
    'success' => true,
    'revision' => syncBuildRevision($parts),
]);
$conn->close();
