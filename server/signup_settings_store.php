<?php

const SIGNUP_SETTINGS_FILE = __DIR__ . '/tmp/signup_settings.json';

function ensureSignupSettingsDirectory()
{
    $dir = dirname(SIGNUP_SETTINGS_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function getDefaultSignupSettings()
{
    return [
        'email_verification_enabled' => true
    ];
}

function readSignupSettings()
{
    ensureSignupSettingsDirectory();

    if (!file_exists(SIGNUP_SETTINGS_FILE)) {
        return getDefaultSignupSettings();
    }

    $raw = file_get_contents(SIGNUP_SETTINGS_FILE);
    if ($raw === false || trim($raw) === '') {
        return getDefaultSignupSettings();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return getDefaultSignupSettings();
    }

    return array_merge(getDefaultSignupSettings(), $decoded);
}

function writeSignupSettings($settings)
{
    ensureSignupSettingsDirectory();
    $nextSettings = array_merge(getDefaultSignupSettings(), $settings);
    file_put_contents(SIGNUP_SETTINGS_FILE, json_encode($nextSettings, JSON_PRETTY_PRINT));
    return $nextSettings;
}

function isSignupEmailVerificationEnabled()
{
    $settings = readSignupSettings();
    return (bool)($settings['email_verification_enabled'] ?? true);
}
