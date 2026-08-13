import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../../lib/adminAuth';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((v) => parseInt(v, 10)).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const bulkAction = (req.body?.bulk_action || '').toString();

  if (!ids.length || !['delete', 'force_paid'].includes(bulkAction)) {
    res.status(400).json({ ok: false, error: 'invalid_request' });
    return;
  }

  if (bulkAction === 'delete') {
    await supabaseAdmin.from('licenses').delete().in('id', ids);
  } else {
    // Same as the single-row "End trial, require paid key" action, applied
    // to every selected row: revoke each one, and lock every trial
    // device's HWID out of future auto-trials.
    const { data: rows } = await supabaseAdmin.from('licenses').select('hwid').in('id', ids).not('hwid', 'is', null);
    await supabaseAdmin.from('licenses').update({ status: 'revoked' }).in('id', ids);

    const uniqueHwids = [...new Set((rows || []).map((r) => r.hwid).filter(Boolean))];
    for (const hwid of uniqueHwids) {
      await supabaseAdmin
        .from('trial_devices')
        .upsert({ hwid, note: 'Trial ended by admin — paid key required (bulk action)' }, { onConflict: 'hwid' });
    }
  }

  res.status(200).json({ ok: true });
}
