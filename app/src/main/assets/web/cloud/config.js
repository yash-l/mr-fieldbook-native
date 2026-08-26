// MR-One cloud config — PUBLIC values only.
//
// The Supabase "anon" key is designed to be shipped in frontend code — it has
// no privileges on its own. Every table it can touch is locked down by Row
// Level Security (see supabase/schema.sql), so the anon key can only ever
// read/write rows where user_id = the signed-in user's own auth.uid().
//
// NEVER put the Supabase "service_role" key here or anywhere in this app.
// The service_role key bypasses RLS entirely and must only ever live on a
// server you control (it has no legitimate use in a static frontend).
//
// Fill these in after creating your Supabase project (Project Settings > API):
window.MR_ONE_CLOUD_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://xxxxxxxxxxxx.supabase.co'
  supabaseAnonKey: '',  // the "anon public" key, NOT service_role
  enabled: false        // flips true automatically once both fields above are filled
};
window.MR_ONE_CLOUD_CONFIG.enabled = Boolean(
  window.MR_ONE_CLOUD_CONFIG.supabaseUrl && window.MR_ONE_CLOUD_CONFIG.supabaseAnonKey
);
