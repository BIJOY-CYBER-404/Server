import { createClient } from '@supabase/supabase-js';

// This uses the SERVICE ROLE key, which bypasses Row Level Security.
// Import this file ONLY from server-side code (pages/api/*, getServerSideProps)
// — never from a component that renders in the browser, or the key would
// end up in the client-side JS bundle.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
