import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireApiSecret } from '../../lib/apiAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!requireApiSecret(req, res)) return;

  const key = (req.body?.key || '').toString().trim().toUpperCase();
  const hwid = (req.body?.hwid || '').toString().trim();
  const name = (req.body?.name || 'USER').toString().trim() || 'USER';
  const deviceModel = (req.body?.device_model || '').toString().trim();
  const androidVersion = (req.body?.android_version || '').toString().trim();
  const appVersion = (req.body?.app_version || '').toString().trim();

  if (!key || !hwid) {
    res.status(400).json({ ok: false, error: 'key_and_hwid_required' });
    return;
  }

  const { data: license } = await supabaseAdmin.from('licenses').select('*').eq('license_key', key).maybeSingle();

  if (!license) {
    res.status(200).json({ ok: false, error: 'key_not_found' });
    return;
  }
  if (license.status !== 'active') {
    res.status(200).json({ ok: false, error: license.status });
    return;
  }
  if (license.hwid && license.hwid !== hwid) {
    res.status(200).json({ ok: false, error: 'key_bound_to_other_device' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('licenses')
    .update({
      hwid,
      customer_name: name,
      device_model: deviceModel,
      android_version: androidVersion,
      app_version: appVersion,
    })
    .eq('id', license.id);

  if (error) {
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  res.status(200).json({ ok: true, valid: true, key: license.license_key, expires_at: license.expires_at });
}
