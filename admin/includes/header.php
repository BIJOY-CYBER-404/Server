<?php
// Expects $pageTitle and $activeNav to be set by the including page,
// and includes/auth.php to already be required (for session + admin_username).
$pageTitle = $pageTitle ?? 'License Admin';
$activeNav = $activeNav ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($pageTitle) ?> — License Admin</title>
<script>
(function () {
    try {
        var saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
        }
    } catch (e) { /* ignore */ }
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="app-shell">
    <aside class="sidebar">
        <div class="brand">
            <span class="brand-mark">◆</span>
            <span class="brand-text">License Admin</span>
        </div>
        <nav class="side-nav">
            <a href="dashboard.php" class="<?= $activeNav === 'dashboard' ? 'active' : '' ?>">
                <span class="nav-icon">▦</span><span>Dashboard</span>
            </a>
            <a href="keys.php" class="<?= $activeNav === 'keys' ? 'active' : '' ?>">
                <span class="nav-icon">🔑</span><span>Licenses</span>
            </a>
            <a href="trials.php" class="<?= $activeNav === 'trials' ? 'active' : '' ?>">
                <span class="nav-icon">⏱</span><span>Trials</span>
            </a>
        </nav>
        <div class="sidebar-footer">
            <a href="logout.php" class="logout-link">⎋ Log out</a>
        </div>
    </aside>

    <div class="main-wrap">
        <header class="topbar">
            <button class="hamburger" data-sidebar-toggle aria-label="Menu">☰</button>
            <h1><?= htmlspecialchars($pageTitle) ?></h1>
            <div class="topbar-spacer"></div>
            <button class="theme-toggle" data-theme-toggle aria-label="Toggle theme" title="Toggle dark / light theme" type="button">
                <span class="icon-sun">☀️</span><span class="icon-moon">🌙</span>
            </button>
            <span class="admin-chip">👤 <?= htmlspecialchars($_SESSION['admin_username'] ?? '') ?></span>
        </header>
        <main class="content">
