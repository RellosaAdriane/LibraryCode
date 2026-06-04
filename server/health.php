<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();

header('Content-Type: application/json');

$meta = libraryNtpSyncMeta();

echo json_encode([
    'status' => 'ok',
    'timezone' => LIBRARY_TIMEZONE,
    'timestamp' => libraryIsoTimestamp(),
    'time_source' => $meta['source'] ?? 'server',
    'time_source_host' => $meta['host'] ?? NTP_DEFAULT_HOST,
]);
