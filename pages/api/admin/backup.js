import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { logActivity } from '../../../lib/activityLog';

const SCOPES = ['admins', 'licenses', 'trials', 'logs'];

// Pulls the full contents of one table, unpaginated. These tables are
// admin-managed and stay small relative to a typical Postgres row limit,
// so a single .select('*') is fine — this endpoint isn't on any
// client-facing hot path.
async function fetchAll(table, orderBy) {
  const { data, error } = await supabaseAdmin.from(table).select('*').order(orderBy, { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const requested = (req.query.scope || 'all').toString();
  const scopes = requested === 'all' ? SCOPES : requested.split(',').filter((s) => SCOPES.includes(s));

  if (!scopes.length) {
    res.status(400).json({ ok: false, error: 'invalid_scope' });
    return;
  }

  try {
    const payload = {
      backup_version: 1,
      created_at: new Date().toISOString(),
      created_by: session.username,
      scopes,
      data: {},
    };

    if (scopes.includes('admins')) {
      // password_hash is a bcrypt hash, not a plaintext password — but
      // it's still the one thing standing between this file and someone
      // logging in as an admin if they get hold of it. Worth saying
      // plainly in the UI (see settings.js) rather than only in a code
      // comment.
      payload.data.admins = await fetchAll('admin_users', 'id');
    }
    if (scopes.includes('licenses')) {
      payload.data.licenses = await fetchAll('licenses', 'id');
    }
    if (scopes.includes('trials')) {
      payload.data.trials = await fetchAll('trial_devices', 'id');
    }
    if (scopes.includes('logs')) {
      payload.data.logs = await fetchAll('activity_logs', 'id');
    }

    await logActivity('backup_created', { scopes }, session.username);
    res.status(200).json({ ok: true, backup: payload });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
