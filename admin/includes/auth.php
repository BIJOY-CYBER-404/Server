<?php
require_once __DIR__ . '/../../config.php';

session_name(ADMIN_SESSION_NAME);
session_start();

function admin_logged_in(): bool {
    return !empty($_SESSION['admin_id']);
}

function require_admin_login(): void {
    if (!admin_logged_in()) {
        header('Location: login.php');
        exit;
    }
}
