<?php
require __DIR__ . '/includes/auth.php';
require_admin_login();

$db = get_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'generate') {
    $name = trim($_POST['customer_name'] ?? 'USER') ?: 'USER';
    $days = trim($_POST['days'] ?? '');
    $expires = ($days === '' || $days === '0') ? null : (new DateTime())->modify("+{$days} days")->format('Y-m-d H:i:s');
    $key = generate_license_key('LIC');

    $stmt = $db->prepare(
        "INSERT INTO licenses (license_key, customer_name, is_trial, expires_at, status) VALUES (?, ?, 0, ?, 'active')"
    );
    $stmt->execute([$key, $name, $expires]);
    header('Location: keys.php?created=' . urlencode($key));
    exit;
}

$statusFilter = $_GET['status'] ?? 'all';
$search = trim($_GET['q'] ?? '');

sync_expired_licenses();

$where = [];
$params = [];
if ($statusFilter === 'trial') {
    $where[] = "is_trial = 1";
} elseif (in_array($statusFilter, ['active', 'revoked', 'expired'], true)) {
    $where[] = "status = ?";
    $params[] = $statusFilter;
}
if ($search !== '') {
    $where[] = "(license_key LIKE ? OR customer_name LIKE ? OR hwid LIKE ?)";
    $like = "%$search%";
    array_push($params, $like, $like, $like);
}
$sql = "SELECT * FROM licenses";
if ($where) $sql .= " WHERE " . implode(' AND ', $where);
$sql .= " ORDER BY created_at DESC LIMIT 200";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$licenses = $stmt->fetchAll();

$counts = $db->query(
    "SELECT
        COUNT(*) total,
        COALESCE(SUM(status='active'),0) active,
        COALESCE(SUM(status='revoked'),0) revoked,
        COALESCE(SUM(status='expired'),0) expired,
        COALESCE(SUM(is_trial=1),0) trial
     FROM licenses"
)->fetch();

$pageTitle = 'Licenses';
$activeNav = 'keys';
require __DIR__ . '/includes/header.php';

function tab_url($status, $search) {
    $q = $status === 'all' ? [] : ['status' => $status];
    if ($search !== '') $q['q'] = $search;
    return 'keys.php' . ($q ? ('?' . http_build_query($q)) : '');
}
?>

<?php if (!empty($_GET['created'])): ?>
    <div class="panel">
        <p class="success">✓ New key created:
            <span class="copy-chip" data-copy="<?= htmlspecialchars($_GET['created']) ?>">
                <?= htmlspecialchars($_GET['created']) ?>
                <span class="copy-icon">⧉</span>
                <span class="copy-tip">Tap to copy</span>
            </span>
        </p>
    </div>
<?php endif; ?>

<div class="tabs">
    <a href="<?= tab_url('all', $search) ?>" class="<?= $statusFilter === 'all' ? 'active' : '' ?>">All (<?= $counts['total'] ?>)</a>
    <a href="<?= tab_url('active', $search) ?>" class="<?= $statusFilter === 'active' ? 'active' : '' ?>">Active (<?= $counts['active'] ?>)</a>
    <a href="<?= tab_url('trial', $search) ?>" class="<?= $statusFilter === 'trial' ? 'active' : '' ?>">Trial (<?= $counts['trial'] ?>)</a>
    <a href="<?= tab_url('expired', $search) ?>" class="<?= $statusFilter === 'expired' ? 'active' : '' ?>">Expired (<?= $counts['expired'] ?>)</a>
    <a href="<?= tab_url('revoked', $search) ?>" class="<?= $statusFilter === 'revoked' ? 'active' : '' ?>">Revoked (<?= $counts['revoked'] ?>)</a>
</div>

<form method="get" class="searchbar">
    <?php if ($statusFilter !== 'all'): ?><input type="hidden" name="status" value="<?= htmlspecialchars($statusFilter) ?>"><?php endif; ?>
    <input type="text" name="q" placeholder="Search key / name / HWID" value="<?= htmlspecialchars($search) ?>">
    <button type="submit" class="btn-sm">Search</button>
</form>

<details class="panel gen-panel">
    <summary>Generate new license key</summary>
    <form method="post">
        <input type="hidden" name="action" value="generate">
        <div class="field-row">
            <label>Customer name</label>
            <input type="text" name="customer_name" placeholder="Name">
        </div>
        <div class="field-row">
            <label>Validity (days — leave blank for lifetime)</label>
            <input type="number" name="days" min="1" placeholder="e.g. 30">
        </div>
        <button type="submit" class="btn-primary">Generate</button>
    </form>
</details>

<form id="bulk-form" method="post" action="bulk_actions.php">
    <input type="hidden" name="return_qs" value="<?= htmlspecialchars($_SERVER['QUERY_STRING'] ?? '') ?>">
    <div class="bulk-bar">
        <span id="bulk-count" class="bulk-count">0 selected</span>
        <button type="submit" name="bulk_action" value="force_paid" class="btn-sm bulk-btn" disabled
                onclick="return confirm('End trial and require a paid key for all selected licenses?')">
            ⛔ End Trial (Force Paid)
        </button>
        <button type="submit" name="bulk_action" value="delete" class="btn-sm btn-danger bulk-btn" disabled
                onclick="return confirm('Permanently delete all selected licenses? This cannot be undone.')">
            🗑 Delete Selected
        </button>
    </div>
</form>

<div class="table-wrap">
    <table>
        <thead>
        <tr>
            <th><input type="checkbox" id="select-all"></th>
            <th>Key</th><th>Name</th><th>HWID</th><th>Status</th><th>Expires</th><th>Time Left</th><th></th>
        </tr>
        </thead>
        <tbody>
        <?php foreach ($licenses as $lic): ?>
            <tr>
                <td><input type="checkbox" class="row-check" name="ids[]" value="<?= (int)$lic['id'] ?>" form="bulk-form"></td>
                <td>
                    <span class="copy-chip" data-copy="<?= htmlspecialchars($lic['license_key']) ?>">
                        <?= htmlspecialchars($lic['license_key']) ?>
                        <span class="copy-icon">⧉</span>
                        <span class="copy-tip">Tap to copy</span>
                    </span>
                </td>
                <td><?= htmlspecialchars($lic['customer_name'] ?? '') ?></td>
                <td class="mono wrap"><?= htmlspecialchars($lic['hwid'] ?? '—') ?></td>
                <td>
                    <span class="badge badge-<?= htmlspecialchars($lic['status']) ?>"><?= htmlspecialchars($lic['status']) ?></span>
                    <?php if ($lic['is_trial']): ?><span class="badge badge-trial">trial</span><?php endif; ?>
                </td>
                <td><?= htmlspecialchars($lic['expires_at'] ?? 'Lifetime') ?></td>
                <td>
                    <?php $tl = time_left_info($lic['expires_at']); ?>
                    <?php if ($tl['level'] === 'lifetime'): ?>
                        <span class="mono">—</span>
                    <?php elseif ($tl['level'] === 'expired'): ?>
                        <span class="badge badge-expired"><?= htmlspecialchars($tl['text']) ?></span>
                    <?php elseif ($tl['level'] === 'soon'): ?>
                        <span class="badge badge-soon"><?= htmlspecialchars($tl['text']) ?></span>
                    <?php else: ?>
                        <span class="mono"><?= htmlspecialchars($tl['text']) ?></span>
                    <?php endif; ?>
                </td>
                <td class="action-cell">
                    <button type="button" class="menu-btn" data-menu-toggle>⋮</button>
                    <div class="action-menu">
                        <?php if ($lic['is_trial'] && $lic['status'] === 'active'): ?>
                            <div class="menu-section-label">Trial</div>
                            <form method="post" action="actions.php"
                                  onsubmit="return confirm('End this trial and force this device to a paid key?')">
                                <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                                <input type="hidden" name="action" value="force_paid">
                                <button type="submit" class="force-item">⛔ End trial, require paid key</button>
                            </form>
                            <div class="divider"></div>
                        <?php endif; ?>

                        <div class="menu-section-label">Device</div>
                        <form method="post" action="actions.php" onsubmit="return confirm('Reset HWID for this key?')">
                            <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                            <input type="hidden" name="action" value="reset_hwid">
                            <button type="submit">↺ Reset HWID</button>
                        </form>

                        <div class="menu-section-label">Status</div>
                        <?php if ($lic['status'] === 'active'): ?>
                            <form method="post" action="actions.php" onsubmit="return confirm('Revoke this key?')">
                                <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                                <input type="hidden" name="action" value="revoke">
                                <button type="submit">⛒ Revoke</button>
                            </form>
                        <?php else: ?>
                            <form method="post" action="actions.php" onsubmit="return confirm('Reactivate this key?')">
                                <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                                <input type="hidden" name="action" value="reactivate">
                                <button type="submit">✓ Reactivate</button>
                            </form>
                        <?php endif; ?>

                        <div class="menu-section-label">Expiry</div>
                        <form method="post" action="actions.php" onsubmit="return confirm('Extend by 30 days?')">
                            <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                            <input type="hidden" name="action" value="extend_30">
                            <button type="submit">+30 days</button>
                        </form>
                        <form method="post" action="actions.php" class="date-row">
                            <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                            <input type="hidden" name="action" value="set_expiry">
                            <input type="date" name="expiry_date"
                                   value="<?= $lic['expires_at'] ? htmlspecialchars(substr($lic['expires_at'], 0, 10)) : '' ?>">
                            <button type="submit" class="btn-sm">Set</button>
                        </form>
                        <form method="post" action="actions.php" onsubmit="return confirm('Make this key lifetime?')">
                            <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                            <input type="hidden" name="action" value="set_lifetime">
                            <button type="submit">∞ Lifetime</button>
                        </form>

                        <div class="divider"></div>
                        <form method="post" action="actions.php" onsubmit="return confirm('Delete permanently? This cannot be undone.')">
                            <input type="hidden" name="id" value="<?= (int)$lic['id'] ?>">
                            <input type="hidden" name="action" value="delete">
                            <button type="submit" class="danger-item">🗑 Delete</button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (!$licenses): ?>
            <tr><td colspan="8" class="empty-state">No licenses found.</td></tr>
        <?php endif; ?>
        </tbody>
    </table>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
