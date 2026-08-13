import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { syncExpiredLicenses } from '../../../lib/licenseHelpers';
import { logActivity } from '../../../lib/activityLog';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    await syncExpiredLicenses();

    // One round trip for all four counts instead of four separate
    // count-only requests — see license_counts() in schema.sql.
    const [settingsResult, countsResult] = await Promise.all([
      supabaseAdmin.from('settings').select('*'),
      supabaseAdmin.rpc('license_counts').maybeSingle(),
    ]);

    const settings = Object.fromEntries((settingsResult.data || []).map((r) => [r.setting_key, r.setting_value]));
    const c = countsResult.data || {};
    const counts = {
      total: Number(c.total) || 0,
      active: Number(c.active) || 0,
      trial: Number(c.trial) || 0,
      expired: Number(c.expired) || 0,
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
      const on = !!req.body?.maintenance;
      await supabaseAdmin.from('settings').upsert({ setting_key: 'maintenance_mode', setting_value: on ? '1' : '0' });
      await logActivity('maintenance_toggled', { on }, session.username);
    } else if (form === 'trial') {
      const on = !!req.body?.trial_enabled;
      await supabaseAdmin.from('settings').upsert({ setting_key: 'trial_enabled', setting_value: on ? '1' : '0' });
      await logActivity('trial_toggled', { on }, session.username);
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
