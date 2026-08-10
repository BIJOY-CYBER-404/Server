<?php
require __DIR__ . '/includes/auth.php';
require_admin_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: keys.php');
    exit;
}

$ids = array_values(array_unique(array_filter(array_map('intval', $_POST['ids'] ?? []))));
$bulkAction = $_POST['bulk_action'] ?? '';
$returnQs = $_POST['return_qs'] ?? '';

if ($ids && in_array($bulkAction, ['delete', 'force_paid'], true)) {
    $db = get_db();
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    if ($bulkAction === 'delete') {
        $stmt = $db->prepare("DELETE FROM licenses WHERE id IN ($placeholders)");
        $stmt->execute($ids);

    } elseif ($bulkAction === 'force_paid') {
        // Same as the single-row "End trial, require paid key" action,
        // just applied to every selected row: revoke it, and make sure
        // each trial device's HWID is explicitly locked out of future
        // auto-trials (it already would be from the original trial grant —
        // this just covers any edge case and makes the intent explicit).
        $stmt = $db->prepare(
            "SELECT hwid FROM licenses WHERE id IN ($placeholders) AND hwid IS NOT NULL"
        );
        $stmt->execute($ids);
        $hwids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $upd = $db->prepare("UPDATE licenses SET status = 'revoked' WHERE id IN ($placeholders)");
        $upd->execute($ids);

        if ($hwids) {
            $lock = $db->prepare(
                "INSERT INTO trial_devices (hwid, note) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE note = VALUES(note)"
            );
            foreach (array_unique($hwids) as $hwid) {
                $lock->execute([$hwid, 'Trial ended by admin — paid key required (bulk action)']);
            }
        }
    }
}

$location = 'keys.php';
if ($returnQs !== '') {
    $location .= '?' . $returnQs;
}
header('Location: ' . $location);
exit;
