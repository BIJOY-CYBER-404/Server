import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireApiSecret } from '../../lib/apiAuth';
import { generateLicenseKey } from '../../lib/licenseKey';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!requireApiSecret(req, res)) return;

  const hwid = (req.body?.hwid || '').toString().trim();
  const deviceModel = (req.body?.device_model || '').toString().trim();
  const androidVersion = (req.body?.android_version || '').toString().trim();
  const appVersion = (req.body?.app_version || '').toString().trim();

  if (!hwid) {
    res.status(400).json({ ok: false, error: 'hwid_required' });
    return;
  }

  // These three reads are all independent of each other — run them
  // concurrently instead of one-at-a-time to cut round-trip latency,
  // since this endpoint is hit on every fresh install.
  const [settingResult, existingTrialResult, existingLicenseResult] = await Promise.all([
    supabaseAdmin.from('settings').select('setting_value').eq('setting_key', 'trial_enabled').maybeSingle(),
    supabaseAdmin.from('trial_devices').select('id, note').eq('hwid', hwid).maybeSingle(),
    supabaseAdmin.from('licenses').select('id').eq('hwid', hwid).maybeSingle(),
  ]);

  // Global admin kill switch for auto-issued trials (Dashboard toggle)
  const trialEnabled = (settingResult.data?.setting_value ?? '1') === '1';
  if (!trialEnabled) {
    res.status(200).json({ ok: true, granted: false, reason: 'trial_disabled' });
    return;
  }

  // Fast, friendly pre-check (not the actual guarantee — see below).
  if (existingTrialResult.data) {
    const reason = existingTrialResult.data.note ? 'trial_blocked' : 'trial_already_used';
    res.status(200).json({ ok: true, granted: false, reason });
    return;
  }

  if (existingLicenseResult.data) {
    res.status(200).json({ ok: true, granted: false, reason: 'device_already_licensed' });
    return;
  }

  const key = generateLicenseKey('TRL');
  const trialDays = parseInt(process.env.TRIAL_DAYS || '2', 10);
  const expiresAt = new Date(Date.now() + trialDays * 86400000).toISOString();

  // The real guarantee that one HWID can only ever get one trial is the
  // UNIQUE constraint on trial_devices.hwid, claimed FIRST. If two requests
  // from the same device raced in at the same moment, only one INSERT can
  // win — Postgres unique_violation (code 23505) turns the loser away.
  const { error: insertTrialError } = await supabaseAdmin.from('trial_devices').insert({ hwid });

  if (insertTrialError) {
    if (insertTrialError.code === '23505') {
      res.status(200).json({ ok: true, granted: false, reason: 'trial_already_used' });
    } else {
      res.status(500).json({ ok: false, error: 'server_error' });
    }
    return;
  }

  const { error: insertLicenseError } = await supabaseAdmin.from('licenses').insert({
    license_key: key,
    customer_name: 'FREE TRIAL USER',
    hwid,
    device_model: deviceModel,
    android_version: androidVersion,
    app_version: appVersion,
    is_trial: true,
    expires_at: expiresAt,
    status: 'active',
  });

  if (insertLicenseError) {
    // Roll back the trial_devices claim so the device can retry, since it
    // never actually got a working trial key.
    await supabaseAdmin.from('trial_devices').delete().eq('hwid', hwid);
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  res.status(200).json({ ok: true, granted: true, key, expires_at: expiresAt });
}
