import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const search = (req.query.q || '').toString().trim();
    let query = supabaseAdmin.from('trial_devices').select('*').order('used_at', { ascending: false }).limit(200);
    if (search) {
      const escaped = search.replace(/[%,]/g, '');
      query = query.or(`hwid.ilike.%${escaped}%,note.ilike.%${escaped}%`);
    }
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ ok: false, error: 'server_error' });
      return;
    }
    res.status(200).json({ ok: true, rows: data || [] });
    return;
  }

  if (req.method === 'POST') {
    const action = (req.body?.action || '').toString();

    if (action === 'block') {
      const hwid = (req.body?.hwid || '').toString().trim();
      const note = (req.body?.note || '').toString().trim() || 'Blocked by admin';
      if (hwid) {
        await supabaseAdmin.from('trial_devices').upsert({ hwid, note }, { onConflict: 'hwid' });
      }
    } else if (action === 'unblock') {
      const id = parseInt(req.body?.id, 10);
      if (id) await supabaseAdmin.from('trial_devices').delete().eq('id', id);
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
