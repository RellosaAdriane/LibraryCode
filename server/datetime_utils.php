<?php

const LIBRARY_TIMEZONE = 'Asia/Manila';
const NTP_UNIX_OFFSET = 2208988800;
const NTP_DEFAULT_HOST = 'time.google.com';
const LIBRARY_NTP_RESYNC_SECONDS = 300;

function initLibraryTimezone(): void
{
    date_default_timezone_set(LIBRARY_TIMEZONE);
}

function libraryTimezone(): DateTimeZone
{
    static $timezone = null;
    if ($timezone === null) {
        $timezone = new DateTimeZone(LIBRARY_TIMEZONE);
    }
    return $timezone;
}

function libraryNtpCacheFile(): string
{
    return __DIR__ . '/.cache/google_ntp_offset.json';
}

function libraryReadNtpCache(): ?array
{
    $path = libraryNtpCacheFile();
    if (!is_readable($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function libraryWriteNtpCache(array $data): void
{
    $path = libraryNtpCacheFile();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        return;
    }

    if (!is_writable($dir) && !(is_file($path) && is_writable($path))) {
        return;
    }

    @file_put_contents($path, json_encode($data, JSON_UNESCAPED_SLASHES), LOCK_EX);
}

/**
 * Query authoritative time from Google Public NTP (UDP port 123).
 */
function queryNtpTime(string $host = NTP_DEFAULT_HOST, float $timeoutSeconds = 2.0): ?DateTimeImmutable
{
    $socket = @stream_socket_client(
        "udp://{$host}:123",
        $errno,
        $errstr,
        $timeoutSeconds,
        STREAM_CLIENT_CONNECT
    );

    if (!$socket) {
        return null;
    }

    stream_set_timeout($socket, (int) ceil($timeoutSeconds));

    // NTP v3 client request (mode 3).
    $request = "\x1b" . str_repeat("\0", 47);
    if (@fwrite($socket, $request) !== 48) {
        fclose($socket);
        return null;
    }

    $response = @fread($socket, 48);
    fclose($socket);

    if (!is_string($response) || strlen($response) < 48) {
        return null;
    }

    $parts = unpack('Nseconds/Nfraction', substr($response, 40, 8));
    $seconds = (int) ($parts['seconds'] ?? 0);
    $fraction = (int) ($parts['fraction'] ?? 0);

    if ($seconds <= 0) {
        return null;
    }

    $unixSeconds = ($seconds - NTP_UNIX_OFFSET) + ($fraction / 4294967296.0);

    return DateTimeImmutable::createFromFormat('U.u', sprintf('%.6F', $unixSeconds))
        ->setTimezone(libraryTimezone());
}

function libraryNowFromGoogleNtp(): ?DateTimeImmutable
{
    return queryNtpTime(NTP_DEFAULT_HOST);
}

/**
 * Refresh and cache the offset between Google NTP and the local system clock.
 */
function libraryRefreshNtpOffset(bool $force = false): array
{
    static $requestCache = null;

    if ($requestCache !== null && !$force) {
        return $requestCache;
    }

    $existing = libraryReadNtpCache();
    $localUnix = microtime(true);

    if (
        !$force
        && $existing
        && isset($existing['synced_at_unix'])
        && ($localUnix - (float) $existing['synced_at_unix']) < LIBRARY_NTP_RESYNC_SECONDS
    ) {
        $requestCache = $existing;
        return $existing;
    }

    $ntp = libraryNowFromGoogleNtp();
    if ($ntp === null) {
        if ($existing) {
            $requestCache = $existing;
            return $existing;
        }

        $fallback = [
            'offset_seconds' => 0.0,
            'source' => 'server',
            'host' => NTP_DEFAULT_HOST,
            'synced_at_unix' => $localUnix,
            'synced_at_iso' => libraryNowFromSystemClock()->format(DateTime::ATOM),
        ];
        libraryWriteNtpCache($fallback);
        $requestCache = $fallback;
        return $fallback;
    }

    $ntpUnix = (float) $ntp->format('U.u');
    $offset = $ntpUnix - $localUnix;
    $data = [
        'offset_seconds' => $offset,
        'source' => 'google_ntp',
        'host' => NTP_DEFAULT_HOST,
        'synced_at_unix' => $localUnix,
        'synced_at_iso' => $ntp->format(DateTime::ATOM),
    ];

    libraryWriteNtpCache($data);
    $requestCache = $data;
    return $data;
}

function libraryNtpOffsetSeconds(): float
{
    return (float) (libraryRefreshNtpOffset()['offset_seconds'] ?? 0.0);
}

function libraryNtpSyncMeta(): array
{
    return libraryRefreshNtpOffset();
}

function libraryNowFromSystemClock(): DateTimeImmutable
{
    return new DateTimeImmutable('now', libraryTimezone());
}

function libraryNow(): DateTimeImmutable
{
    libraryRefreshNtpOffset();
    $unix = microtime(true) + libraryNtpOffsetSeconds();

    return DateTimeImmutable::createFromFormat('U.u', sprintf('%.6F', $unix))
        ->setTimezone(libraryTimezone());
}

function libraryUnixTime(): int
{
    libraryRefreshNtpOffset();
    return (int) floor(microtime(true) + libraryNtpOffsetSeconds());
}

function libraryTodayStart(): DateTimeImmutable
{
    return libraryNow()->setTime(0, 0, 0);
}

/**
 * Format a MySQL DATETIME (library-local) as Y-m-d for API responses.
 */
function formatLibraryDate(?string $datetime): ?string
{
    if ($datetime === null || trim($datetime) === '') {
        return null;
    }

    try {
        $parsed = new DateTimeImmutable($datetime, libraryTimezone());
        return $parsed->format('Y-m-d');
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Full ISO-8601 timestamp for clients (relative time, sorting).
 */
function formatLibraryIso(?string $datetime): ?string
{
    if ($datetime === null || trim($datetime) === '') {
        return null;
    }

    try {
        $parsed = new DateTimeImmutable($datetime, libraryTimezone());
        return $parsed->format(DateTime::ATOM);
    } catch (Exception $e) {
        return null;
    }
}

function formatLibraryDateTime(): string
{
    return libraryNow()->format('Y-m-d H:i:s');
}

function libraryIsoTimestamp(): string
{
    return libraryNow()->format(DateTime::ATOM);
}

function initLibraryDatabaseTimezone($conn): void
{
    if ($conn instanceof mysqli) {
        $conn->query("SET time_zone = '+08:00'");
    }
}
