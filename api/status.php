<?php
require __DIR__ . '/../config.php';
require_api_secret();

echo json_encode([
    'ok' => true,
    'maintenance' => get_setting('maintenance_mode', '0') === '1',
    'version' => get_setting('current_version', '1.0'),
]);
