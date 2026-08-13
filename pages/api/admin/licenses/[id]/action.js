import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdminApi } from '../../../../../lib/adminAuth';
import { logActivity } from '../../../../../lib/activityLog';

export default async function handler(req, res) {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const id = parseInt(req.query.id, 10);
  const action = (req.body?.action || '').toString();
  if (!id || !action) {
    res.status(400).json({ ok: false, error: 'missing_fields' });
    return;
  }

  switch (action) {
    case 'reset_hwid':
      await supabaseAdmin.from('licenses').update({ hwid: null }).eq('id', id);
      break;

    case 'revoke':
      await supabaseAdmin.from('licenses').update({ status: 'revoked' }).eq('id', id);
      break;

    case 'reactivate':
      await supabaseAdmin.from('licenses').update({ status: 'active' }).eq('id', id);
      break;

    case 'extend_30': {
      const { data: lic } = await supabaseAdmin.from('licenses').select('expires_at').eq('id', id).maybeSingle();
      const now = Date.now();
      const currentExpiry = lic?.expires_at ? new Date(lic.expires_at).getTime() : null;
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(base + 30 * 86400000).toISOString();
      await supabaseAdmin.from('licenses').update({ expires_at: newExpiry, status: 'active' }).eq('id', id);
      break;
    }

    case 'set_expiry': {
      const date = (req.body?.expiry_date || '').toString().trim();
      if (date) {
        const dt = new Date(`${date}T23:59:59.000Z`);
        if (!isNaN(dt.getTime())) {
          await supabaseAdmin.from('licenses').update({ expires_at: dt.toISOString(), status: 'active' }).eq('id', id);
        }
      }
      break;
    }

    case 'set_lifetime':
      await supabaseAdmin.from('licenses').update({ expires_at: null, status: 'active' }).eq('id', id);
      break;

    case 'force_paid': {
      // Ends an active trial immediately and makes sure this HWID is
      // recorded as trial-used, so it can never auto-get another trial.
      const { data: lic } = await supabaseAdmin.from('licenses').select('hwid').eq('id', id).maybeSingle();
      await supabaseAdmin.from('licenses').update({ status: 'revoked' }).eq('id', id);
      if (lic?.hwid) {
        await supabaseAdmin
          .from('trial_devices')
          .upsert({ hwid: lic.hwid, note: 'Trial ended by admin — paid key required' }, { onConflict: 'hwid' });
      }
      break;
    }

    case 'delete':
      await supabaseAdmin.from('licenses').delete().eq('id', id);
      break;

    default:
      res.status(400).json({ ok: false, error: 'unknown_action' });
      return;
  }

  await logActivity('license_action', { id, action }, session.username);
  res.status(200).json({ ok: true });
}
