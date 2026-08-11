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

    const { data: licenses, error } = await query;
    if (error) {
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }

    const { data: allLicenses } = await supabaseAdmin.from('licenses').select('status, is_trial');
    const counts = {
      total: allLicenses?.length || 0,
      active: allLicenses?.filter((l) => l.status === 'active').length || 0,
      revoked: allLicenses?.filter((l) => l.status === 'revoked').length || 0,
      expired: allLicenses?.filter((l) => l.status === 'expired').length || 0,
      trial: allLicenses?.filter((l) => l.is_trial).length || 0,
    };

    res.status(200).json({ ok: true, licenses: licenses || [], counts });
    return;
  }

  if (req.method === 'POST') {
    const name = (req.body?.customer_name || 'USER').toString().trim() || 'USER';
    const days = (req.body?.days || '').toString().trim();
    const expiresAt = !days || days === '0' ? null : new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString();
    const key = generateLicenseKey('LIC');

    const { error } = await supabaseAdmin.from('licenses').insert({
      license_key: key,
      customer_name: name,
      is_trial: false,
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
