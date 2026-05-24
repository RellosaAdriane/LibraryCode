<?php

const ANNOUNCEMENT_SETTINGS_FILE = __DIR__ . '/tmp/announcement_settings.json';

function ensureAnnouncementSettingsDirectory()
{
    $dir = dirname(ANNOUNCEMENT_SETTINGS_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function getDefaultAnnouncementSettings()
{
    return [
        'enabled' => false,
        'title' => 'Library Notice',
        'message' => '',
        'updated_at' => null
    ];
}

function readAnnouncementSettings()
{
    ensureAnnouncementSettingsDirectory();

    if (!file_exists(ANNOUNCEMENT_SETTINGS_FILE)) {
        return getDefaultAnnouncementSettings();
    }

    $raw = file_get_contents(ANNOUNCEMENT_SETTINGS_FILE);
    if ($raw === false || trim($raw) === '') {
        return getDefaultAnnouncementSettings();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return getDefaultAnnouncementSettings();
    }

    return array_merge(getDefaultAnnouncementSettings(), $decoded);
}

function writeAnnouncementSettings($settings)
{
    ensureAnnouncementSettingsDirectory();

    $nextSettings = array_merge(getDefaultAnnouncementSettings(), $settings);
    $nextSettings['enabled'] = (bool)($nextSettings['enabled'] ?? false);
    $nextSettings['title'] = trim((string)($nextSettings['title'] ?? '')) ?: 'Library Notice';
    $nextSettings['message'] = trim((string)($nextSettings['message'] ?? ''));
    $nextSettings['updated_at'] = date('c');

    file_put_contents(ANNOUNCEMENT_SETTINGS_FILE, json_encode($nextSettings, JSON_PRETTY_PRINT));
    return $nextSettings;
}