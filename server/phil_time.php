<?php
require_once __DIR__ . '/datetime_utils.php';
initLibraryTimezone();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

try {
    $meta = libraryRefreshNtpOffset(true);
    $dt = libraryNow();
    $iso = $dt->format(DateTime::ATOM);
    $human = $dt->format('M d, Y h:i:s A');
    $timestampMs = (int) round((float) $dt->format('U.u') * 1000);

    echo json_encode([
        'success' => true,
        'timezone' => LIBRARY_TIMEZONE,
        'source' => $meta['source'] ?? 'server',
        'source_host' => $meta['host'] ?? NTP_DEFAULT_HOST,
        'offset_ms' => (int) round(((float) ($meta['offset_seconds'] ?? 0)) * 1000),
        'last_sync' => $meta['synced_at_iso'] ?? $iso,
        'time' => $human,
        'iso' => $iso,
        'timestamp_ms' => $timestampMs,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to get library time',
    ]);
}
