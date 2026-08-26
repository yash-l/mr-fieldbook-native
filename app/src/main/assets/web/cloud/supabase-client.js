// MR-One cloud — Supabase client bootstrap.
// Depends on: supabase-js UMD + window.MR_ONE_CLOUD_CONFIG.
(function () {
  'use strict';
  const cfg = window.MR_ONE_CLOUD_CONFIG || {};
  let client = null;

  function getClient() {
    if (!cfg.enabled) return null;
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('MR-One cloud: supabase-js failed to load — check network/CDN access.');
      return null;
    }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mr-one-cloud-auth' }
    });
    return client;
  }

  function resetClient() { client = null; }

  window.MRCloud = window.MRCloud || {};
  window.MRCloud.getClient = getClient;
  window.MRCloud.resetClient = resetClient;
  window.MRCloud.isEnabled = () => Boolean(cfg.enabled);
})();
