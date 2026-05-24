<?php

require_once __DIR__ . '/db.php';

function getDefaultSsoSettings()
{
    return [
        'enabled' => false,
        'provider_name' => 'SSO / LDAP',
        'allowed_domains' => ['cvsu.edu.ph'],
        'admin_only' => false
    ];
}

function readSsoSettings()
{
    global $conn;
    $result = $conn->query("SELECT enabled, provider_name, allowed_domains, admin_only FROM sso_settings WHERE id = 1 LIMIT 1");
    if (!$result) {
        return getDefaultSsoSettings();
    }

    $row = $result->fetch_assoc();
    if (!$row) {
        return getDefaultSsoSettings();
    }

    $decoded = json_decode($row['allowed_domains'] ?? '', true);
    $domains = is_array($decoded) ? $decoded : getDefaultSsoSettings()['allowed_domains'];

    return [
        'enabled' => (bool)($row['enabled'] ?? false),
        'provider_name' => $row['provider_name'] ?: 'SSO / LDAP',
        'allowed_domains' => $domains,
        'admin_only' => (bool)($row['admin_only'] ?? false)
    ];
}

function sanitizeSsoDomains($domains)
{
    if (!is_array($domains)) {
        return [];
    }

    $cleaned = [];
    foreach ($domains as $domain) {
        $domain = strtolower(trim((string)$domain));
        if ($domain === '') {
            continue;
        }
        $cleaned[] = $domain;
    }

    return array_values(array_unique($cleaned));
}

function writeSsoSettings($settings)
{
    $nextSettings = array_merge(getDefaultSsoSettings(), $settings);
    $nextSettings['allowed_domains'] = sanitizeSsoDomains($nextSettings['allowed_domains'] ?? []);
    $nextSettings['provider_name'] = trim((string)($nextSettings['provider_name'] ?? '')) ?: 'SSO / LDAP';
    $nextSettings['enabled'] = (bool)($nextSettings['enabled'] ?? false);
    $nextSettings['admin_only'] = (bool)($nextSettings['admin_only'] ?? false);
    $allowedDomains = json_encode($nextSettings['allowed_domains']);

    global $conn;
    $stmt = $conn->prepare("INSERT INTO sso_settings (id, enabled, provider_name, allowed_domains, admin_only)
        VALUES (1, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), provider_name = VALUES(provider_name),
        allowed_domains = VALUES(allowed_domains), admin_only = VALUES(admin_only), updated_at = CURRENT_TIMESTAMP");
    if ($stmt) {
        $enabled = $nextSettings['enabled'] ? 1 : 0;
        $adminOnly = $nextSettings['admin_only'] ? 1 : 0;
        $stmt->bind_param('issi', $enabled, $nextSettings['provider_name'], $allowedDomains, $adminOnly);
        $stmt->execute();
        $stmt->close();
    }

    return $nextSettings;
}
