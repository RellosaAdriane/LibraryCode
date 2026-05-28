<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();

header('Content-Type: application/json');

echo json_encode([
    'status' => 'ok',
    'timezone' => LIBRARY_TIMEZONE,
    'timestamp' => libraryIsoTimestamp()
]);
