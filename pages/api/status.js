import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireApiSecret } from '../../lib/apiAuth';

export default async function handler(req, res) {
  if (!requireApiSecret(req, res)) return;

  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['maintenance_mode', 'current_version']);

  if (error) {
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  const settings = Object.fromEntries((data || []).map((r) => [r.setting_key, r.setting_value]));

  // This gets hit on every launch of every install of the client tool, and
  // maintenance/version essentially never change between one request and
  // the next. Letting Vercel's edge cache serve it for a few seconds
  // means most launches skip the Supabase round trip entirely instead of
  // paying it on every single check — worst case, a maintenance toggle
  // takes up to 10s to reach clients instead of being instant.
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=59');
  res.status(200).json({
    ok: true,
    maintenance: settings.maintenance_mode === '1',
    version: settings.current_version || '1.0',
  });
}
