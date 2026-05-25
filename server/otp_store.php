<?php
// OTP storage helper: prefers DB table 'otp_store' when available, falls back to JSON files.

require_once __DIR__ . '/db.php';

function otp_db_available()
{
    global $conn;
    if (!isset($conn) || !($conn instanceof mysqli)) return false;
    $res = $conn->query("SHOW TABLES LIKE 'otp_store'");
    return $res && $res->num_rows > 0;
}

function otp_file_path_for_type($type)
{
    $map = [
        'signup' => __DIR__ . '/tmp/signup_otp_store.json',
        'reset' => __DIR__ . '/tmp/reset_otp_store.json',
        'link' => __DIR__ . '/tmp/google_link_otp_store.json'
    ];
    return $map[$type] ?? (__DIR__ . '/tmp/' . $type . '_otp_store.json');
}

function otp_read_all_file($type)
{
    $path = otp_file_path_for_type($type);
    if (!file_exists($path)) return [];
    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function otp_write_all_file($type, $store)
{
    $path = otp_file_path_for_type($type);
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
        return false;
    }

    $json = json_encode($store, JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }

    return file_put_contents($path, $json, LOCK_EX) !== false;
}

function otp_get_record($type, $email)
{
    $emailKey = strtolower(trim((string)$email));
    if (otp_db_available()) {
        global $conn;
        $stmt = $conn->prepare('SELECT email, otp_hash, expires_at, attempts, last_sent_at FROM otp_store WHERE LOWER(email) = LOWER(?) AND type = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('ss', $email, $type);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            $stmt->close();
            return $row ?: null;
        }
        return null;
    }

    $store = otp_read_all_file($type);
    foreach ($store as $k => $v) {
        if (strtolower(trim((string)$k)) === $emailKey) {
            return $v;
        }
    }
    return null;
}

function otp_set_record($type, $email, $otp_hash, $expires_at, $attempts = 0, $last_sent_at = null)
{
    $emailKey = strtolower(trim((string)$email));
    if (otp_db_available()) {
        global $conn;
        $now = time();
        $last = $last_sent_at ?? $now;
        // Upsert-like behavior
        $stmt = $conn->prepare('SELECT id FROM otp_store WHERE LOWER(email) = LOWER(?) AND type = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('ss', $email, $type);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            $stmt->close();
            if ($row) {
                $upd = $conn->prepare('UPDATE otp_store SET otp_hash = ?, expires_at = ?, attempts = ?, last_sent_at = ? WHERE id = ?');
                if ($upd) {
                    $id = $row['id'];
                    $upd->bind_param('siiii', $otp_hash, $expires_at, $attempts, $last, $id);
                    $upd->execute();
                    $upd->close();
                    return true;
                }
            } else {
                $ins = $conn->prepare('INSERT INTO otp_store (email, type, otp_hash, expires_at, attempts, last_sent_at) VALUES (?, ?, ?, ?, ?, ?)');
                if ($ins) {
                    $ins->bind_param('sssiii', $email, $type, $otp_hash, $expires_at, $attempts, $last);
                    $ins->execute();
                    $ins->close();
                    return true;
                }
            }
        }
        return false;
    }

    $store = otp_read_all_file($type);
    $store[$emailKey] = [
        'otp_hash' => $otp_hash,
        'expires_at' => $expires_at,
        'attempts' => $attempts,
        'last_sent_at' => $last_sent_at ?? time()
    ];
    return otp_write_all_file($type, $store);
}

function otp_delete_record($type, $email)
{
    $emailKey = strtolower(trim((string)$email));
    if (otp_db_available()) {
        global $conn;
        $stmt = $conn->prepare('DELETE FROM otp_store WHERE LOWER(email) = LOWER(?) AND type = ?');
        if ($stmt) {
            $stmt->bind_param('ss', $email, $type);
            $stmt->execute();
            $stmt->close();
            return true;
        }
        return false;
    }

    $store = otp_read_all_file($type);
    $found = null;
    foreach ($store as $k => $v) {
        if (strtolower(trim((string)$k)) === $emailKey) {
            $found = $k;
            break;
        }
    }
    if ($found !== null) {
        unset($store[$found]);
        return otp_write_all_file($type, $store);
    }
    return true;
}

function otp_increment_attempts($type, $email)
{
    if (otp_db_available()) {
        global $conn;
        $stmt = $conn->prepare('UPDATE otp_store SET attempts = attempts + 1 WHERE LOWER(email) = LOWER(?) AND type = ?');
        if ($stmt) {
            $stmt->bind_param('ss', $email, $type);
            $stmt->execute();
            $stmt->close();
            return true;
        }
        return false;
    }

    $emailKey = strtolower(trim((string)$email));
    $store = otp_read_all_file($type);
    foreach ($store as $k => $v) {
        if (strtolower(trim((string)$k)) === $emailKey) {
            $store[$k]['attempts'] = (int)($v['attempts'] ?? 0) + 1;
            return otp_write_all_file($type, $store);
        }
    }
    return false;
}

?>
