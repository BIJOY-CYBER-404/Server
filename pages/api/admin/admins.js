import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi, createSessionCookie } from '../../../lib/adminAuth';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }
    res.status(200).json({ ok: true, admins: data || [] });
    return;
  }

  if (req.method === 'POST') {
    const username = (req.body?.username || '').toString().trim();
    const password = (req.body?.password || '').toString();

    if (!username || password.length < 8) {
      res.status(400).json({ ok: false, error: 'invalid_input' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const { error } = await supabaseAdmin.from('admin_users').insert({ username, password_hash: passwordHash });

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ ok: false, error: 'username_taken' });
      } else {
        res.status(500).json({ ok: false, error: 'server_error' });
      }
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id, 10);
    if (!id) {
      res.status(400).json({ ok: false, error: 'missing_id' });
      return;
    }
    if (id === session.id) {
      res.status(400).json({ ok: false, error: 'cannot_delete_self' });
      return;
    }
    await supabaseAdmin.from('admin_users').delete().eq('id', id);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'PATCH') {
    // Self-service: change my own username and/or password. Requires the
    // current password regardless of what's being changed, so a session
    // left open on a shared/unlocked device can't be used to silently
    // take over the account.
    const currentPassword = (req.body?.current_password || '').toString();
    const newUsername = (req.body?.username || '').toString().trim();
    const newPassword = (req.body?.password || '').toString();

    const { data: me } = await supabaseAdmin.from('admin_users').select('*').eq('id', session.id).maybeSingle();
    if (!me || !bcrypt.compareSync(currentPassword, me.password_hash)) {
      res.status(401).json({ ok: false, error: 'wrong_current_password' });
      return;
    }
    if (newPassword && newPassword.length < 8) {
      res.status(400).json({ ok: false, error: 'password_too_short' });
      return;
    }

    const update = {};
    if (newUsername) update.username = newUsername;
    if (newPassword) update.password_hash = bcrypt.hashSync(newPassword, 10);

    if (Object.keys(update).length === 0) {
      res.status(200).json({ ok: true, username: me.username });
      return;
    }

    const { error } = await supabaseAdmin.from('admin_users').update(update).eq('id', session.id);
    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ ok: false, error: 'username_taken' });
      } else {
        res.status(500).json({ ok: false, error: 'server_error' });
      }
      return;
    }

    // The session cookie embeds the username for display purposes — reissue
    // it so the topbar reflects a username change without forcing a fresh
    // login.
    const finalUsername = newUsername || me.username;
    res.setHeader('Set-Cookie', createSessionCookie({ id: session.id, username: finalUsername }, req));
    res.status(200).json({ ok: true, username: finalUsername });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
