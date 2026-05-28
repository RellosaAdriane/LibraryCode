<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();

header('Content-Type: application/json; charset=utf-8');

try {
    $dt = libraryNow();
    $iso = $dt->format(DateTime::ATOM);
    $human = $dt->format('M d, Y H:i:s');
    $timestamp_ms = (int)($dt->getTimestamp() * 1000);

    echo json_encode([
        'success' => true,
        'timezone' => LIBRARY_TIMEZONE,
        'time' => $human,
        'iso' => $iso,
        'timestamp_ms' => $timestamp_ms,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to get server time',
    ]);
}

// EOF
