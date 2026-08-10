<?php
require __DIR__ . '/includes/auth.php';
require_admin_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $form = $_POST['form'] ?? '';
    if ($form === 'maintenance') {
        set_setting('maintenance_mode', isset($_POST['maintenance']) ? '1' : '0');
    } elseif ($form === 'trial') {
        set_setting('trial_enabled', isset($_POST['trial_enabled']) ? '1' : '0');
    }
}

header('Location: dashboard.php');
exit;
