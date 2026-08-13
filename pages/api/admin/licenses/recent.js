import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../../lib/adminAuth';

// Dashboard "Last 24 Hours" log. Reads straight off licenses.created_at
// rather than activity_logs — a key can come into existence three ways
// (admin generates one, a device auto-issues a trial, an admin-created
// trial key gets activated onto a device) and every one of those already
// stamps created_at, so this stays accurate without needing every one of
// those code paths to also remember to write an activity_logs row.
export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .select('id, license_key, customer_name, is_trial, expires_at, created_at, status')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  res.status(200).json({ ok: true, licenses: data || [] });
}
