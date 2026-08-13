import { supabaseAdmin } from './supabaseAdmin';

// Fire-and-forget audit trail for admin-panel actions (never called from
// the client-facing status/check/trial/activate endpoints — those are hit
// by every install of the Android tool and logging every one of them
// would drown out the actions an admin actually cares about).
//
// Logging failures never break the action that triggered them: this is
// always awaited but wrapped so a logging hiccup can't turn a successful
// license action into a 500.
export async function logActivity(action, details, adminUsername) {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      action,
      details: details || null,
      admin_username: adminUsername || null,
    });
  } catch (e) {
    // Swallow — logging is best-effort.
  }
}
