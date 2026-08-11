import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { syncExpiredLicenses } from '../../../lib/licenseHelpers';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    await syncExpiredLicenses();

    const { data: settingsRows } = await supabaseAdmin.from('settings').select('*');
    const settings = Object.fromEntries((settingsRows || []).map((r) => [r.setting_key, r.setting_value]));

    const { data: licenses } = await supabaseAdmin.from('licenses').select('status, is_trial');
    const counts = {
      total: licenses?.length || 0,
      active: licenses?.filter((l) => l.status === 'active').length || 0,
      trial: licenses?.filter((l) => l.is_trial).length || 0,
      expired: licenses?.filter((l) => l.status === 'expired').length || 0,
    };

    res.status(200).json({
      ok: true,
      maintenance: settings.maintenance_mode === '1',
      trial_enabled: (settings.trial_enabled ?? '1') === '1',
      counts,
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
