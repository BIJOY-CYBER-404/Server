<?php
// ---------------------------------------------------------------
// License System - Shared Configuration
// Fill in your DB credentials and a random API secret below.
// If your host allows it, keep this file outside the public web
// root (e.g. one level above public_html) and require_once it
// with a relative path instead.
// ---------------------------------------------------------------

// Every expires_at value, every DateTime comparison, and the client's own
// countdown calculation all need to agree on the same clock. Shared hosts
// often default PHP to UTC but not always — pinning it explicitly here
// means every new DateTime()/date() call in this whole app is UTC,
// regardless of the host's php.ini. The Python client mirrors this by
// using datetime.utcnow() instead of datetime.now().
date_default_timezone_set('UTC');

define('DB_HOST', 'localhost');
define('DB_NAME', 'suyycidamr_license_sys007');
define('DB_USER', 'suyycidamr_license_sys007');
define('DB_PASS', '#Bijoy@0053$');

// Shared secret the Python client must send in the X-Api-Secret header.
// Generate one with: php -r "echo bin2hex(random_bytes(32));"
define('API_SECRET', 'XqzLYq8pa1sSfbJ4OEZGF74GWN5aHfjBnALQ1Qouj45');

// Admin panel session cookie name
define('ADMIN_SESSION_NAME', 'license_admin_session');

// Free trial length in days
define('TRIAL_DAYS', 2);

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    }
    return $pdo;
}

function get_setting(string $key, $default = null) {
    $stmt = get_db()->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['setting_value'] : $default;
}

function set_setting(string $key, string $value): void {
    $stmt = get_db()->prepare(
        "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
    );
    $stmt->execute([$key, $value]);
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Every API endpoint (except none) must call this. The original tool this
// is modeled on had NO auth on its database calls at all — anyone could
// read or write any record. This shared-secret header is the minimum fix.
function require_api_secret(): void {
    $secret = $_SERVER['HTTP_X_API_SECRET'] ?? '';
    header('Content-Type: application/json');
    if (!is_string($secret) || $secret === '' || !hash_equals(API_SECRET, $secret)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'unauthorized']);
        exit;
    }
}

function generate_license_key(string $prefix = 'LIC'): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
    $out = $prefix . '-';
    for ($i = 0; $i < 3; $i++) {
        for ($j = 0; $j < 4; $j++) {
            $out .= $chars[random_int(0, strlen($chars) - 1)];
        }
        if ($i < 2) $out .= '-';
    }
    return $out;
}

// A license's status only flips to 'expired' in api/check.php, and that
// only runs when the device it belongs to actually checks in. A device
// that's gone quiet after its expiry date (uninstalled, phone off, no
// internet) never triggers that, so the stored `status` column can stay
// 'active' indefinitely even though `expires_at` is long past. The admin
// panel calls this on every page load so the Expired tab/badge/count are
// always accurate regardless of whether any client has phoned home.
//
// Uses PHP's own current UTC time as a bound parameter rather than MySQL's
// NOW() — MySQL has its own, separately configured `time_zone` setting
// that has no relation to PHP's date_default_timezone_set() above, so
// mixing the two would just reintroduce the same kind of offset bug this
// whole change is fixing.
function sync_expired_licenses(): void {
    $nowUtc = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
    $stmt = get_db()->prepare(
        "UPDATE licenses SET status = 'expired'
         WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?"
    );
    $stmt->execute([$nowUtc]);
}

// Human-readable "time left" for the admin panel, e.g. "2d 4h left",
// "Expired", or "Lifetime". Always computed in UTC, matching how
// expires_at is stored and how the client's own countdown is computed.
function time_left_info(?string $expiresAt): array {
    if ($expiresAt === null) {
        return ['text' => 'Lifetime', 'level' => 'lifetime'];
    }
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $exp = new DateTime($expiresAt, new DateTimeZone('UTC'));
    $diff = $exp->getTimestamp() - $now->getTimestamp();

    if ($diff <= 0) {
        return ['text' => 'Expired', 'level' => 'expired'];
    }

    $days = intdiv($diff, 86400);
    $hours = intdiv($diff % 86400, 3600);
    $minutes = intdiv($diff % 3600, 60);

    if ($days > 0) {
        $text = "{$days}d {$hours}h left";
    } elseif ($hours > 0) {
        $text = "{$hours}h {$minutes}m left";
    } else {
        $text = "{$minutes}m left";
    }

    $level = ($diff < 86400) ? 'soon' : 'ok';
    return ['text' => $text, 'level' => $level];
}
