import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { logActivity } from '../../../lib/activityLog';

const SCOPES = ['admins', 'licenses', 'trials', 'logs'];

// Restore is deliberately a MERGE, not a wipe-and-replace: rows in the
// backup are upserted against each table's natural unique key
// (username / license_key / hwid), and anything currently in the
// database that ISN'T in the backup is left alone. A destructive restore
// is one accidental click away from deleting live licenses — upsert-only
// means the worst case of restoring the wrong file is "some rows got
// overwritten with older data", never "everything not in this file is
// gone". `id` is stripped from every row so Postgres assigns a fresh
// identity on insert; only the natural key decides whether a row is new
// or an update.
async function upsertRows(table, rows, conflictColumn) {
  if (!rows || !rows.length) return 0;
  const cleaned = rows.map(({ id, ...rest }) => rest).filter((r) => r[conflictColumn]);
  if (!cleaned.length) return 0;
  const { error } = await supabaseAdmin.from(table).upsert(cleaned, { onConflict: conflictColumn });
  if (error) throw new Error(error.message);
  return cleaned.length;
}

async function insertLogs(rows) {
  if (!rows || !rows.length) return 0;
  const cleaned = rows.map(({ id, ...rest }) => rest);
  const { error } = await supabaseAdmin.from('activity_logs').insert(cleaned);
  if (error) throw new Error(error.message);
  return cleaned.length;
}

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const backup = req.body?.backup;
  const data = backup?.data;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ ok: false, error: 'invalid_backup_file' });
    return;
  }

  const requestedScope = (req.body?.scope || 'all').toString();
  const scopes =
    requestedScope === 'all' ? SCOPES.filter((s) => data[s]) : requestedScope.split(',').filter((s) => SCOPES.includes(s) && data[s]);

  if (!scopes.length) {
    res.status(400).json({ ok: false, error: 'nothing_to_restore' });
    return;
  }

  try {
    const restored = {};
    if (scopes.includes('admins')) restored.admins = await upsertRows('admin_users', data.admins, 'username');
    if (scopes.includes('licenses')) restored.licenses = await upsertRows('licenses', data.licenses, 'license_key');
    if (scopes.includes('trials')) restored.trials = await upsertRows('trial_devices', data.trials, 'hwid');
    if (scopes.includes('logs')) restored.logs = await insertLogs(data.logs);

    await logActivity('backup_restored', { scopes, restored }, session.username);
    res.status(200).json({ ok: true, restored });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
