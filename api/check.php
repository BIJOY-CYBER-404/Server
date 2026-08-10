<?php
require __DIR__ . '/../config.php';
require_api_secret();

$input = json_input();
$hwid = trim($input['hwid'] ?? '');
$key  = trim(strtoupper($input['key'] ?? ''));

if ($hwid === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'hwid_required']);
    exit;
}

$db = get_db();
$license = null;

if ($key !== '') {
    $stmt = $db->prepare("SELECT * FROM licenses WHERE license_key = ?");
    $stmt->execute([$key]);
    $license = $stmt->fetch();

    if ($license && $license['hwid'] && $license['hwid'] !== $hwid) {
        echo json_encode(['ok' => true, 'valid' => false, 'reason' => 'key_bound_to_other_device']);
        exit;
    }
}

if (!$license) {
    // Covers reinstalls: find any license already bound to this HWID.
    $stmt = $db->prepare("SELECT * FROM licenses WHERE hwid = ? LIMIT 1");
    $stmt->execute([$hwid]);
    $license = $stmt->fetch();
}

if (!$license) {
    echo json_encode(['ok' => true, 'valid' => false, 'reason' => 'no_license']);
    exit;
}

if ($license['expires_at'] !== null) {
    if (new DateTime($license['expires_at']) < new DateTime()) {
        $upd = $db->prepare("UPDATE licenses SET status = 'expired' WHERE id = ?");
        $upd->execute([$license['id']]);
        echo json_encode(['ok' => true, 'valid' => false, 'reason' => 'expired']);
        exit;
    }
}

if ($license['status'] !== 'active') {
    echo json_encode(['ok' => true, 'valid' => false, 'reason' => $license['status']]);
    exit;
}

echo json_encode([
    'ok' => true,
    'valid' => true,
    'key' => $license['license_key'],
    'name' => $license['customer_name'],
    'expires_at' => $license['expires_at'],
    'is_trial' => (bool)$license['is_trial'],
]);
