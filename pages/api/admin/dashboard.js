import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { syncExpiredLicenses } from '../../../lib/licenseHelpers';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  await syncExpiredLicenses();

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [totalResult, activeResult, trialResult, expiredResult, recentResult] = await Promise.all([
    supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('is_trial', true),
    supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    supabaseAdmin.from('licenses').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
  ]);

  const counts = {
    total: totalResult.count || 0,
    active: activeResult.count || 0,
    trial: trialResult.count || 0,
    expired: expiredResult.count || 0,
  };

  res.status(200).json({ ok: true, counts, recent: recentResult.data || [] });
}
