import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  const providedToken = req.headers['x-setup-token'] || req.body?.setup_token;

  if (!setupToken || providedToken !== setupToken) {
    res.status(403).json({ ok: false, error: 'setup_disabled_or_wrong_token' });
    return;
  }

  // Second layer of protection, independent of the token: this only ever
  // works while zero admins exist, so even if the token leaks later it
  // can't be used to create a second admin account.
  const { count } = await supabaseAdmin.from('admin_users').select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    res.status(403).json({ ok: false, error: 'admin_already_exists' });
    return;
  }

  const username = (req.body?.username || '').toString().trim();
  const password = (req.body?.password || '').toString();

  if (!username || password.length < 8) {
    res.status(400).json({ ok: false, error: 'invalid_input' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const { error } = await supabaseAdmin.from('admin_users').insert({ username, password_hash: passwordHash, is_primary: true });

  if (error) {
    res.status(500).json({ ok: false, error: 'server_error' });
    return;
  }

  res.status(200).json({ ok: true });
}
