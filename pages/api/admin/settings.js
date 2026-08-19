import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('settings').select('*');
    const settings = Object.fromEntries((data || []).map((r) => [r.setting_key, r.setting_value]));

    res.status(200).json({
      ok: true,
      maintenance: settings.maintenance_mode === '1',
      trial_enabled: (settings.trial_enabled ?? '1') === '1',
    });
    return;
  }

  if (req.method === 'POST') {
    const form = (req.body?.form || '').toString();
    if (form === 'maintenance') {
      const value = req.body?.maintenance ? '1' : '0';
      await supabaseAdmin.from('settings').upsert({ setting_key: 'maintenance_mode', setting_value: value });
    } else if (form === 'trial') {
      const value = req.body?.trial_enabled ? '1' : '0';
      await supabaseAdmin.from('settings').upsert({ setting_key: 'trial_enabled', setting_value: value });
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
