import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import bcrypt from 'bcryptjs';
import { createSessionCookie } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const username = (req.body?.username || '').toString().trim();
  const password = (req.body?.password || '').toString();

  if (!username || !password) {
    res.status(400).json({ ok: false, error: 'missing_fields' });
    return;
  }

  const { data: admin } = await supabaseAdmin.from('admin_users').select('*').eq('username', username).maybeSingle();

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    res.status(401).json({ ok: false, error: 'invalid_credentials' });
    return;
  }

  res.setHeader('Set-Cookie', createSessionCookie(admin));
  res.status(200).json({ ok: true, username: admin.username });
}
