import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
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

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
