<?php

const PENALTY_SETTINGS_FILE = __DIR__ . '/tmp/penalty_settings.json';

function ensurePenaltySettingsDirectory()
{
    $dir = dirname(PENALTY_SETTINGS_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function getDefaultPenaltySettings()
{
    return [
        'grace_days' => 7,
        'daily_fee' => 150,
        'block_overdue_days' => 14
    ];
}

function readPenaltySettings()
{
    ensurePenaltySettingsDirectory();

    if (!file_exists(PENALTY_SETTINGS_FILE)) {
        return getDefaultPenaltySettings();
    }

    $raw = file_get_contents(PENALTY_SETTINGS_FILE);
    if ($raw === false || trim($raw) === '') {
        return getDefaultPenaltySettings();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return getDefaultPenaltySettings();
    }

    return array_merge(getDefaultPenaltySettings(), $decoded);
}

function writePenaltySettings($settings)
{
    ensurePenaltySettingsDirectory();

    $clean = [
        'grace_days' => max(0, (int)($settings['grace_days'] ?? 7)),
        'daily_fee' => max(0, (float)($settings['daily_fee'] ?? 150)),
        'block_overdue_days' => max(0, (int)($settings['block_overdue_days'] ?? 14))
    ];

    $nextSettings = array_merge(getDefaultPenaltySettings(), $clean);
    file_put_contents(PENALTY_SETTINGS_FILE, json_encode($nextSettings, JSON_PRETTY_PRINT));
    return $nextSettings;
}
