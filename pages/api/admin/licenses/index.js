import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../../lib/adminAuth';
import { generateLicenseKey } from '../../../../lib/licenseKey';
import { syncExpiredLicenses } from '../../../../lib/licenseHelpers';
import { logActivity } from '../../../../lib/activityLog';

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

    // The list query and the counts run concurrently. Counts come from a
    // single Postgres function call (license_counts(), see schema.sql)
    // instead of 5 separate count-only requests — same idea (no row data
    // transferred), one round trip instead of five.
    const [listResult, countsResult] = await Promise.all([query, supabaseAdmin.rpc('license_counts').maybeSingle()]);

    if (listResult.error) {
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }

    const c = countsResult.data || {};
    const counts = {
      total: Number(c.total) || 0,
      active: Number(c.active) || 0,
      revoked: Number(c.revoked) || 0,
      expired: Number(c.expired) || 0,
      trial: Number(c.trial) || 0,
    };

    res.status(200).json({ ok: true, licenses: listResult.data || [], counts });
    return;
  }

  if (req.method === 'POST') {
    const name = (req.body?.customer_name || 'USER').toString().trim() || 'USER';
    const days = (req.body?.days || '').toString().trim();
    const isTrial = (req.body?.type || 'paid').toString() === 'trial';
    const expiresAt = !days || days === '0' ? null : new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString();
    const key = generateLicenseKey(isTrial ? 'TRL' : 'LIC');

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

    await logActivity(
      'license_generated',
      { key, customer_name: name, type: isTrial ? 'trial' : 'paid', days: days || null },
      session.username
    );

    res.status(200).json({ ok: true, key });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
