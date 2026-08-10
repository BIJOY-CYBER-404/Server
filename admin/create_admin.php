<?php
// ONE-TIME SETUP SCRIPT.
// Run this once via your browser to create your first admin login,
// then DELETE this file (or move it out of the web root). Leaving it
// live lets anyone who finds the URL create themselves an admin account.

require __DIR__ . '/../config.php';

$message = '';
$ok = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username && strlen($password) >= 8) {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = get_db()->prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)");
        $stmt->execute([$username, $hash]);
        $ok = true;
        $message = "Admin '$username' created. Delete this file now, then log in at login.php.";
    } else {
        $message = 'Username is required and password must be at least 8 characters.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Create Admin — License Admin</title>
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
<body class="login-page">
<button class="theme-toggle theme-toggle-floating" data-theme-toggle aria-label="Toggle theme" title="Toggle dark / light theme" type="button">
    <span class="icon-sun">☀️</span><span class="icon-moon">🌙</span>
</button>
<form class="login-box" method="post">
    <span class="brand-mark">◆</span>
    <h2>Create First Admin</h2>
    <?php if ($message): ?>
        <p class="<?= $ok ? 'success' : 'error' ?>"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>
    <?php if (!$ok): ?>
        <label>Username</label>
        <input name="username" required>
        <label>Password</label>
        <input name="password" type="password" required minlength="8">
        <button type="submit" class="btn-primary btn-block">Create</button>
    <?php else: ?>
        <a href="login.php" class="btn btn-primary btn-block" style="text-align:center;">Go to Login →</a>
    <?php endif; ?>
</form>
<script src="assets/app.js"></script>
</body>
</html>
