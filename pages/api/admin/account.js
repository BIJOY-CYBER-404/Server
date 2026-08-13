import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi, createSessionCookie } from '../../../lib/adminAuth';
import bcrypt from 'bcryptjs';
import { logActivity } from '../../../lib/activityLog';

// Lets the logged-in admin change their own username and/or password.
// Always requires the current password, even just to change the
// username — this endpoint is reachable by anyone holding a valid
// session cookie, so it's the one place we re-check a secret the cookie
// itself doesn't carry.
export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const currentPassword = (req.body?.current_password || '').toString();
  const newUsername = (req.body?.new_username || '').toString().trim();
  const newPassword = (req.body?.new_password || '').toString();

  if (!currentPassword) {
    res.status(400).json({ ok: false, error: 'current_password_required' });
    return;
  }
  if (!newUsername && !newPassword) {
    res.status(400).json({ ok: false, error: 'nothing_to_update' });
    return;
  }
  if (newPassword && newPassword.length < 8) {
    res.status(400).json({ ok: false, error: 'password_too_short' });
    return;
  }

  const { data: admin } = await supabaseAdmin.from('admin_users').select('*').eq('id', session.id).maybeSingle();
  if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
    res.status(401).json({ ok: false, error: 'wrong_current_password' });
    return;
  }

  const update = {};
  if (newUsername && newUsername !== admin.username) update.username = newUsername;
  if (newPassword) update.password_hash = bcrypt.hashSync(newPassword, 10);

  if (Object.keys(update).length === 0) {
    res.status(200).json({ ok: true, username: admin.username });
    return;
  }

  const { error } = await supabaseAdmin.from('admin_users').update(update).eq('id', admin.id);
  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ ok: false, error: 'username_taken' });
    } else {
      res.status(500).json({ ok: false, error: 'server_error' });
    }
    return;
  }

  const finalUsername = update.username || admin.username;
  await logActivity(
    'admin_account_updated',
    { changed: Object.keys(update).map((k) => (k === 'password_hash' ? 'password' : k)) },
    finalUsername
  );

  // The session cookie carries {id, username} — if the username changed,
  // re-sign a fresh cookie with the new value now, or the next request
  // would still show the old username until re-login.
  res.setHeader('Set-Cookie', createSessionCookie({ id: admin.id, username: finalUsername }, req));
  res.status(200).json({ ok: true, username: finalUsername });
}
