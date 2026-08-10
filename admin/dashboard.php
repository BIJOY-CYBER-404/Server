<?php
require __DIR__ . '/includes/auth.php';
require_admin_login();

$db = get_db();
sync_expired_licenses();

$totalLicenses = $db->query("SELECT COUNT(*) c FROM licenses")->fetch()['c'];
$activeLicenses = $db->query("SELECT COUNT(*) c FROM licenses WHERE status='active'")->fetch()['c'];
$trialLicenses = $db->query("SELECT COUNT(*) c FROM licenses WHERE is_trial=1")->fetch()['c'];
$expiredLicenses = $db->query("SELECT COUNT(*) c FROM licenses WHERE status='expired'")->fetch()['c'];

$maintenance = get_setting('maintenance_mode', '0') === '1';
$trialEnabled = get_setting('trial_enabled', '1') === '1';

$pageTitle = 'Dashboard';
$activeNav = 'dashboard';
require __DIR__ . '/includes/header.php';
?>
<div class="cards">
    <div class="card">
        <span class="num"><?= $totalLicenses ?></span>
        <span class="label">Total Licenses</span>
    </div>
    <div class="card tone-green">
        <span class="num"><?= $activeLicenses ?></span>
        <span class="label">Active</span>
    </div>
    <div class="card tone-blue">
        <span class="num"><?= $trialLicenses ?></span>
        <span class="label">Trials Issued</span>
    </div>
    <div class="card tone-red">
        <span class="num"><?= $expiredLicenses ?></span>
        <span class="label">Expired</span>
    </div>
</div>

<h2>System Controls</h2>

<div class="panel">
    <div class="panel-row">
        <label class="switch">
            <input type="checkbox" onchange="document.getElementById('maintenance-form').submit()"
                   <?= $maintenance ? 'checked' : '' ?>
                   form="maintenance-form" name="maintenance" value="1">
            <span class="track"></span>
            <span class="switch-label">Maintenance mode — block all clients</span>
        </label>
    </div>
    <p class="hint">When on, every client sees the maintenance message on its next launch — without you touching any keys.</p>
    <form id="maintenance-form" method="post" action="settings.php" hidden>
        <input type="hidden" name="form" value="maintenance">
    </form>
</div>

<div class="panel">
    <div class="panel-row">
        <label class="switch">
            <input type="checkbox" onchange="document.getElementById('trial-form').submit()"
                   <?= $trialEnabled ? 'checked' : '' ?>
                   form="trial-form" name="trial_enabled" value="1">
            <span class="track"></span>
            <span class="switch-label">Allow new devices to auto-get a free trial</span>
        </label>
    </div>
    <p class="hint">Off = new devices go straight to "enter a license key" — no auto-trial. Trial keys already issued keep working until they expire.</p>
    <form id="trial-form" method="post" action="settings.php" hidden>
        <input type="hidden" name="form" value="trial">
    </form>
</div>

<p><a href="keys.php">Manage Licenses →</a> &nbsp;·&nbsp; <a href="trials.php">Manage Trial-Blocked Devices →</a></p>

<?php require __DIR__ . '/includes/footer.php'; ?>
