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
  res.status(200).json({
    ok: true,
    maintenance: settings.maintenance_mode === '1',
    version: settings.current_version || '1.0',
  });
}
