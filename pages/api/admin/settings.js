import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { syncExpiredLicenses } from '../../../lib/licenseHelpers';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    await syncExpiredLicenses();

    const [settingsResult, totalResult, activeResult, trialResult, expiredResult] = await Promise.all([
      supabaseAdmin.from('settings').select('*'),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('is_trial', true),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    ]);

    const settings = Object.fromEntries((settingsResult.data || []).map((r) => [r.setting_key, r.setting_value]));
    const counts = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      trial: trialResult.count || 0,
      expired: expiredResult.count || 0,
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
