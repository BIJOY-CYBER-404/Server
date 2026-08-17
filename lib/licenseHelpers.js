import { supabaseAdmin } from './supabaseAdmin';

// Same fix as the PHP version's sync_expired_licenses(): a license's status
// only flips to 'expired' when its own device checks in after its expiry
// date (see pages/api/check.js). A device that's gone quiet after expiring
// never triggers that, so the stored status can stay 'active' indefinitely.
// The admin pages call this on load so the Expired tab/badge/count are
// always accurate regardless of whether any client has phoned home.
export async function syncExpiredLicenses() {
  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from('licenses')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso);
}

export function timeLeftLabel(expiresAt) {
  if (!expiresAt) return { text: 'Lifetime', tone: 'lifetime' };
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return { text: 'Expired', tone: 'expired' };

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const tone = diffMs < 24 * 3600 * 1000 ? 'soon' : 'ok';

  if (days > 0) return { text: `${days}d ${hours}h left`, tone };
  if (hours > 0) return { text: `${hours}h ${minutes}m left`, tone };
  return { text: `${minutes}m left`, tone };
}
