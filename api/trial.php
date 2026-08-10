<?php
require __DIR__ . '/../config.php';
require_api_secret();

$input = json_input();
$hwid = trim($input['hwid'] ?? '');
$device_model = trim($input['device_model'] ?? '');
$android_version = trim($input['android_version'] ?? '');
$app_version = trim($input['app_version'] ?? '');

if ($hwid === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'hwid_required']);
    exit;
}

// Global admin kill switch for auto-issued trials (Dashboard → Free Trial toggle)
if (get_setting('trial_enabled', '1') !== '1') {
    echo json_encode(['ok' => true, 'granted' => false, 'reason' => 'trial_disabled']);
    exit;
}

$db = get_db();

// Fast, friendly pre-checks (not the actual guarantee — see below).
$stmt = $db->prepare("SELECT id, note FROM trial_devices WHERE hwid = ?");
$stmt->execute([$hwid]);
if ($existing = $stmt->fetch()) {
    $reason = ($existing['note'] !== null) ? 'trial_blocked' : 'trial_already_used';
    echo json_encode(['ok' => true, 'granted' => false, 'reason' => $reason]);
    exit;
}

$stmt = $db->prepare("SELECT id FROM licenses WHERE hwid = ?");
$stmt->execute([$hwid]);
if ($stmt->fetch()) {
    echo json_encode(['ok' => true, 'granted' => false, 'reason' => 'device_already_licensed']);
    exit;
}

$key = generate_license_key('TRL');
$expires = (new DateTime())->modify('+' . TRIAL_DAYS . ' days')->format('Y-m-d H:i:s');

// The real guarantee that one HWID can only ever get one trial is the
// UNIQUE constraint on trial_devices.hwid, claimed FIRST, inside the
// transaction. If two requests race in at the same moment, only one INSERT
// can win — the loser hits a duplicate-key error and is turned away, so
// there's no window where both could slip past the pre-checks above and
// both get issued a trial.
$db->beginTransaction();
try {
    $mark = $db->prepare("INSERT INTO trial_devices (hwid) VALUES (?)");
    $mark->execute([$hwid]);
} catch (PDOException $e) {
    $db->rollBack();
    if ($e->getCode() === '23000') {
        echo json_encode(['ok' => true, 'granted' => false, 'reason' => 'trial_already_used']);
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'server_error']);
    }
    exit;
}

try {
    $ins = $db->prepare(
        "INSERT INTO licenses (license_key, customer_name, hwid, device_model, android_version, app_version, is_trial, expires_at, status)
         VALUES (?, 'FREE TRIAL USER', ?, ?, ?, ?, 1, ?, 'active')"
    );
    $ins->execute([$key, $hwid, $device_model, $android_version, $app_version, $expires]);
    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_error']);
    exit;
}

echo json_encode(['ok' => true, 'granted' => true, 'key' => $key, 'expires_at' => $expires]);
