<?php

function syncTableExists(mysqli $conn, string $table): bool
{
    $escaped = $conn->real_escape_string($table);
    $result = $conn->query("SHOW TABLES LIKE '{$escaped}'");
    return $result && $result->num_rows > 0;
}

function syncTableRevision(mysqli $conn, string $table, string $sql): string
{
    if (!syncTableExists($conn, $table)) {
        return "{$table}:0";
    }

    $result = $conn->query($sql);
    if (!$result) {
        return "{$table}:0";
    }

    $row = $result->fetch_assoc();
    $result->free();

    if (!$row) {
        return "{$table}:0";
    }

    return "{$table}:" . implode(':', array_map(static function ($value) {
        return (string)($value ?? '');
    }, array_values($row)));
}

function syncFileRevision(string $label, string $path): string
{
    if (!is_file($path)) {
        return "{$label}:0";
    }

    $mtime = filemtime($path);
    $size = filesize($path);

    return "{$label}:" . ($mtime !== false ? $mtime : 0) . ':' . ($size !== false ? $size : 0);
}

function syncSettingsFileRevisions(): array
{
    $baseDir = dirname(__DIR__);

    return [
        syncFileRevision('announcement_settings', $baseDir . '/tmp/announcement_settings.json'),
        syncFileRevision('penalty_settings', $baseDir . '/tmp/penalty_settings.json'),
        syncFileRevision('signup_settings', $baseDir . '/tmp/signup_settings.json'),
    ];
}

function syncBooksRevision(mysqli $conn): string
{
    return syncTableRevision(
        $conn,
        'books',
        "SELECT COUNT(*) AS row_count,
                COALESCE(MAX(updated_at), '') AS max_updated,
                COALESCE(MAX(id), 0) AS max_id,
                COALESCE(SUM(copies_available), 0) AS available_total
         FROM books"
    );
}

function syncBuildRevision(array $parts): string
{
    return hash('sha256', implode('|', $parts));
}
