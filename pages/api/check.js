import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireApiSecret } from '../../lib/apiAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!requireApiSecret(req, res)) return;

  const hwid = (req.body?.hwid || '').toString().trim();
  const key = (req.body?.key || '').toString().trim().toUpperCase();

  if (!hwid) {
    res.status(400).json({ ok: false, error: 'hwid_required' });
    return;
  }

  let license = null;

  if (key) {
    const { data } = await supabaseAdmin.from('licenses').select('*').eq('license_key', key).maybeSingle();
    if (data) {
      if (data.hwid && data.hwid !== hwid) {
        res.status(200).json({ ok: true, valid: false, reason: 'key_bound_to_other_device' });
        return;
      }
      if (!data.hwid) {
        // Key matched and nothing else owns it (e.g. right after an admin
        // HWID reset). Silently claim it for this device now, instead of
        // leaving it unbound until the customer manually re-enters the key
        // via activate.php — that gap would let a second device also
        // successfully activate the same key in the meantime. Only hwid is
        // written here; name/device_model stay untouched (that's
        // activate.php's job, not a routine check's).
        await supabaseAdmin.from('licenses').update({ hwid }).eq('id', data.id);
        data.hwid = hwid;
      }
      license = data;
    }
  }

  if (!license) {
    // Covers reinstalls: find any license already bound to this HWID.
    const { data } = await supabaseAdmin.from('licenses').select('*').eq('hwid', hwid).limit(1).maybeSingle();
    license = data || null;
  }

  if (!license) {
    res.status(200).json({ ok: true, valid: false, reason: 'no_license' });
    return;
  }

  if (license.expires_at) {
    if (new Date(license.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from('licenses').update({ status: 'expired' }).eq('id', license.id);
      res.status(200).json({ ok: true, valid: false, reason: 'expired' });
      return;
    }
  }

  if (license.status !== 'active') {
    res.status(200).json({ ok: true, valid: false, reason: license.status });
    return;
  }

  res.status(200).json({
    ok: true,
    valid: true,
    key: license.license_key,
    name: license.customer_name,
    expires_at: license.expires_at,
    is_trial: !!license.is_trial,
  });
}
