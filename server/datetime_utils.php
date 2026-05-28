<?php

const LIBRARY_TIMEZONE = 'Asia/Manila';

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

function libraryNow(): DateTimeImmutable
{
    return new DateTimeImmutable('now', libraryTimezone());
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
