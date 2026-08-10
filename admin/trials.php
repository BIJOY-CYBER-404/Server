<?php
require __DIR__ . '/includes/auth.php';
require_admin_login();

$db = get_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'block') {
        $hwid = trim($_POST['hwid'] ?? '');
        $note = trim($_POST['note'] ?? '') ?: 'Blocked by admin';
        if ($hwid !== '') {
            $stmt = $db->prepare(
                "INSERT INTO trial_devices (hwid, note) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE note = VALUES(note)"
            );
            $stmt->execute([$hwid, $note]);
        }
    } elseif ($action === 'unblock') {
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $db->prepare("DELETE FROM trial_devices WHERE id = ?");
        $stmt->execute([$id]);
    }

    header('Location: trials.php');
    exit;
}

$search = trim($_GET['q'] ?? '');
if ($search !== '') {
    $like = "%$search%";
    $stmt = $db->prepare(
        "SELECT * FROM trial_devices WHERE hwid LIKE ? OR note LIKE ? ORDER BY used_at DESC LIMIT 200"
    );
    $stmt->execute([$like, $like]);
} else {
    $stmt = $db->query("SELECT * FROM trial_devices ORDER BY used_at DESC LIMIT 200");
}
$rows = $stmt->fetchAll();

$pageTitle = 'Trials';
$activeNav = 'trials';
require __DIR__ . '/includes/header.php';
?>

<div class="panel">
    <p class="hint">
        Every HWID here can never auto-receive another free trial — that's what
        guarantees one trial per device even if the app's local cache files are
        wiped. Rows with a note were blocked manually by you rather than earned
        by an actual trial grant. Remove a row to let that HWID try again.
    </p>
</div>

<form method="get" class="searchbar">
    <input type="text" name="q" placeholder="Search HWID / note" value="<?= htmlspecialchars($search) ?>">
    <button type="submit" class="btn-sm">Search</button>
</form>

<details class="panel gen-panel">
    <summary>Block a HWID from trials (before it ever requests one)</summary>
    <form method="post">
        <input type="hidden" name="action" value="block">
        <div class="field-row">
            <label>HWID</label>
            <input type="text" name="hwid" placeholder="Exact HWID string" required>
        </div>
        <div class="field-row">
            <label>Note (optional)</label>
            <input type="text" name="note" placeholder="e.g. known emulator fingerprint">
        </div>
        <button type="submit" class="btn-primary">Block</button>
    </form>
</details>

<div class="table-wrap">
    <table>
        <thead><tr><th>HWID</th><th>Note</th><th>Recorded</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($rows as $row): ?>
            <tr>
                <td class="mono wrap"><?= htmlspecialchars($row['hwid']) ?></td>
                <td><?= htmlspecialchars($row['note'] ?? '—') ?></td>
                <td><?= htmlspecialchars($row['used_at']) ?></td>
                <td class="action-cell">
                    <form method="post" onsubmit="return confirm('Allow this HWID to get a trial again?')">
                        <input type="hidden" name="action" value="unblock">
                        <input type="hidden" name="id" value="<?= (int)$row['id'] ?>">
                        <button type="submit" class="btn-sm btn-ghost">Remove</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?>
            <tr><td colspan="4" class="empty-state">No trial records yet.</td></tr>
        <?php endif; ?>
        </tbody>
    </table>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
