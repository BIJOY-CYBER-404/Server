<?php
require __DIR__ . '/../config.php';
require_api_secret();

$input = json_input();
$key = trim(strtoupper($input['key'] ?? ''));
$hwid = trim($input['hwid'] ?? '');
$name = trim($input['name'] ?? 'USER');
$device_model = trim($input['device_model'] ?? '');
$android_version = trim($input['android_version'] ?? '');
$app_version = trim($input['app_version'] ?? '');

if ($key === '' || $hwid === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'key_and_hwid_required']);
    exit;
}

$db = get_db();
$stmt = $db->prepare("SELECT * FROM licenses WHERE license_key = ?");
$stmt->execute([$key]);
$license = $stmt->fetch();

if (!$license) {
    echo json_encode(['ok' => false, 'error' => 'key_not_found']);
    exit;
}

if ($license['status'] !== 'active') {
    echo json_encode(['ok' => false, 'error' => $license['status']]);
    exit;
}

if ($license['hwid'] && $license['hwid'] !== $hwid) {
    echo json_encode(['ok' => false, 'error' => 'key_bound_to_other_device']);
    exit;
}

$upd = $db->prepare(
    "UPDATE licenses SET hwid = ?, customer_name = ?, device_model = ?, android_version = ?, app_version = ?
     WHERE id = ?"
);
$upd->execute([$hwid, $name, $device_model, $android_version, $app_version, $license['id']]);

echo json_encode([
    'ok' => true,
    'valid' => true,
    'key' => $license['license_key'],
    'expires_at' => $license['expires_at'],
]);
