import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../lib/adminAuth';
import { logActivity } from '../../../lib/activityLog';

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
      let revokedCount = 0;

      if (hwid) {
        await supabaseAdmin.from('trial_devices').upsert({ hwid, note }, { onConflict: 'hwid' });

        // Blocking a HWID only stops it from getting a NEW auto-trial in
        // the future (trial.php checks trial_devices). On its own that
        // leaves an EXISTING active license for this HWID completely
        // untouched — the device just keeps using what it already had,
        // since it never needs to ask trial.php for anything while its
        // current license is still valid. So "block this device" also
        // revokes whatever's currently active for it, making the action
        // actually cut the device off rather than only closing the door
        // for next time.
        const { data: revoked } = await supabaseAdmin
          .from('licenses')
          .update({ status: 'revoked' })
          .eq('hwid', hwid)
          .eq('status', 'active')
          .select('id');
        revokedCount = revoked?.length || 0;
      }

      await logActivity('trial_blocked', { hwid, note, revoked: revokedCount }, session.username);
      res.status(200).json({ ok: true, revoked: revokedCount });
      return;
    } else if (action === 'unblock') {
      const id = parseInt(req.body?.id, 10);
      if (id) {
        const { data: row } = await supabaseAdmin.from('trial_devices').select('hwid').eq('id', id).maybeSingle();
        await supabaseAdmin.from('trial_devices').delete().eq('id', id);
        await logActivity('trial_unblocked', { hwid: row?.hwid }, session.username);
      }
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
