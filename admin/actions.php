<?php
require __DIR__ . '/includes/auth.php';
require_admin_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: keys.php');
    exit;
}

$id = (int)($_POST['id'] ?? 0);
$action = $_POST['action'] ?? '';
$db = get_db();

switch ($action) {
    case 'reset_hwid':
        $stmt = $db->prepare("UPDATE licenses SET hwid = NULL WHERE id = ?");
        $stmt->execute([$id]);
        break;
    case 'revoke':
        $stmt = $db->prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?");
        $stmt->execute([$id]);
        break;
    case 'reactivate':
        $stmt = $db->prepare("UPDATE licenses SET status = 'active' WHERE id = ?");
        $stmt->execute([$id]);
        break;
    case 'extend_30':
        $stmt = $db->prepare("SELECT expires_at FROM licenses WHERE id = ?");
        $stmt->execute([$id]);
        $current = $stmt->fetch();

        $nowUtc = new DateTime('now', new DateTimeZone('UTC'));
        $currentExpiry = ($current && $current['expires_at'])
            ? new DateTime($current['expires_at'], new DateTimeZone('UTC'))
            : null;

        $base = ($currentExpiry && $currentExpiry > $nowUtc) ? $currentExpiry : $nowUtc;
        $newExpiry = (clone $base)->modify('+30 days');

        $upd = $db->prepare("UPDATE licenses SET expires_at = ?, status = 'active' WHERE id = ?");
        $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $id]);
        break;
    case 'delete':
        $stmt = $db->prepare("DELETE FROM licenses WHERE id = ?");
        $stmt->execute([$id]);
        break;
    case 'set_expiry':
        $date = trim($_POST['expiry_date'] ?? '');
        if ($date !== '') {
            try {
                $dt = new DateTime($date . ' 23:59:59', new DateTimeZone('UTC'));
                $stmt = $db->prepare("UPDATE licenses SET expires_at = ?, status = 'active' WHERE id = ?");
                $stmt->execute([$dt->format('Y-m-d H:i:s'), $id]);
            } catch (Exception $e) {
                // Invalid date typed in — ignore rather than crash.
            }
        }
        break;
    case 'set_lifetime':
        $stmt = $db->prepare("UPDATE licenses SET expires_at = NULL, status = 'active' WHERE id = ?");
        $stmt->execute([$id]);
        break;
    case 'force_paid':
        // Ends an active trial immediately and makes sure this HWID is
        // recorded as trial-used (it already would be, from when the trial
        // was granted — this just makes the intent explicit and covers any
        // trial that was created another way, e.g. manually in the DB).
        $stmt = $db->prepare("SELECT hwid FROM licenses WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        $upd = $db->prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?");
        $upd->execute([$id]);

        if ($row && $row['hwid']) {
            $lock = $db->prepare(
                "INSERT INTO trial_devices (hwid, note) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE note = VALUES(note)"
            );
            $lock->execute([$row['hwid'], 'Trial ended by admin — paid key required']);
        }
        break;
}

header('Location: keys.php');
exit;
