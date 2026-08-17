import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const type = (req.query.type || 'full').toString();
    const data = {
      format: 'license-system-backup',
      version: 1,
      exported_at: new Date().toISOString(),
    };

    if (type === 'full' || type === 'settings') {
      const { data: rows } = await supabaseAdmin.from('settings').select('setting_key, setting_value');
      data.settings = rows || [];
    }
    if (type === 'full' || type === 'admins') {
      // Includes password_hash (a bcrypt hash, not a plaintext password)
      // so a restored admin account can still log in. Still sensitive —
      // treat backup files as private, same as you would a password
      // manager export.
      const { data: rows } = await supabaseAdmin.from('admin_users').select('username, password_hash, created_at');
      data.admin_accounts = rows || [];
    }
    if (type === 'full' || type === 'licenses') {
      const { data: rows } = await supabaseAdmin
        .from('licenses')
        .select(
          'license_key, customer_name, hwid, device_model, android_version, app_version, is_trial, expires_at, status, created_at, updated_at'
        );
      data.licenses = rows || [];
    }
    if (type === 'full' || type === 'trials') {
      const { data: rows } = await supabaseAdmin.from('trial_devices').select('hwid, note, used_at');
      data.trials = rows || [];
    }

    const safeType = type.replace(/[^a-z]/g, '');
    const filename = `license-system-backup-${safeType}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(data, null, 2));
    return;
  }

  if (req.method === 'POST') {
    const data = req.body;
    if (!data || data.format !== 'license-system-backup') {
      res.status(400).json({ ok: false, error: 'invalid_backup_file' });
      return;
    }

    const summary = {};
    const tasks = [];

    // Restoring merges (upserts) — matching records get updated, new ones
    // get added, nothing already in the database gets deleted. Works the
    // same whether the file is a full backup or a single-category one,
    // since it just processes whichever keys are present. Each category
    // is one batched upsert call, and all categories run concurrently.
    if (Array.isArray(data.settings)) {
      const rows = data.settings
        .filter((r) => r?.setting_key)
        .map((r) => ({ setting_key: r.setting_key, setting_value: r.setting_value ?? '' }));
      summary.settings = rows.length;
      if (rows.length) tasks.push(supabaseAdmin.from('settings').upsert(rows));
    }

    if (Array.isArray(data.admin_accounts)) {
      const rows = data.admin_accounts
        .filter((r) => r?.username && r?.password_hash)
        .map((r) => ({
          username: r.username,
          password_hash: r.password_hash,
          created_at: r.created_at || new Date().toISOString(),
        }));
      summary.admin_accounts = rows.length;
      if (rows.length) tasks.push(supabaseAdmin.from('admin_users').upsert(rows, { onConflict: 'username' }));
    }

    if (Array.isArray(data.licenses)) {
      const rows = data.licenses
        .filter((r) => r?.license_key)
        .map((r) => ({
          license_key: r.license_key,
          customer_name: r.customer_name ?? null,
          hwid: r.hwid ?? null,
          device_model: r.device_model ?? null,
          android_version: r.android_version ?? null,
          app_version: r.app_version ?? null,
          is_trial: !!r.is_trial,
          expires_at: r.expires_at ?? null,
          status: r.status ?? 'active',
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));
      summary.licenses = rows.length;
      if (rows.length) tasks.push(supabaseAdmin.from('licenses').upsert(rows, { onConflict: 'license_key' }));
    }

    if (Array.isArray(data.trials)) {
      const rows = data.trials
        .filter((r) => r?.hwid)
        .map((r) => ({ hwid: r.hwid, note: r.note ?? null, used_at: r.used_at || new Date().toISOString() }));
      summary.trials = rows.length;
      if (rows.length) tasks.push(supabaseAdmin.from('trial_devices').upsert(rows, { onConflict: 'hwid' }));
    }

    await Promise.all(tasks);

    res.status(200).json({ ok: true, summary });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
