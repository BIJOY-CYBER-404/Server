import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../../lib/adminAuth';
import { generateLicenseKey } from '../../../../lib/licenseKey';
import { syncExpiredLicenses } from '../../../../lib/licenseHelpers';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    await syncExpiredLicenses();

    const status = (req.query.status || 'all').toString();
    const search = (req.query.q || '').toString().trim();

    let query = supabaseAdmin.from('licenses').select('*').order('created_at', { ascending: false }).limit(200);

    if (status === 'trial') {
      query = query.eq('is_trial', true);
    } else if (['active', 'revoked', 'expired'].includes(status)) {
      query = query.eq('status', status);
    }

    if (search) {
      const escaped = search.replace(/[%,]/g, '');
      query = query.or(`license_key.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,hwid.ilike.%${escaped}%`);
    }

    // Run the list query and every count query concurrently instead of
    // fetching every row just to count them in JS afterward — count-only
    // queries (head: true) transfer no row data and stay fast as the
    // table grows.
    const [listResult, totalResult, activeResult, revokedResult, expiredResult, trialResult] = await Promise.all([
      query,
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'revoked'),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
      supabaseAdmin.from('licenses').select('*', { count: 'exact', head: true }).eq('is_trial', true),
    ]);

    if (listResult.error) {
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }

    const counts = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      revoked: revokedResult.count || 0,
      expired: expiredResult.count || 0,
      trial: trialResult.count || 0,
    };

    res.status(200).json({ ok: true, licenses: listResult.data || [], counts });
    return;
  }

  if (req.method === 'POST') {
    const name = (req.body?.customer_name || 'USER').toString().trim() || 'USER';
    const days = (req.body?.days || '').toString().trim();
    const isTrial = (req.body?.type || 'paid').toString() === 'trial';
    const expiresAt = !days || days === '0' ? null : new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString();
    const key = generateLicenseKey(isTrial ? 'TRL' : 'BKS');

    const { error } = await supabaseAdmin.from('licenses').insert({
      license_key: key,
      customer_name: name,
      is_trial: isTrial,
      expires_at: expiresAt,
      status: 'active',
    });

    if (error) {
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }

    res.status(200).json({ ok: true, key });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
