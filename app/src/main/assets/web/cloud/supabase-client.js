// MR-One cloud — Supabase client bootstrap.
// Depends on: the supabase-js UMD build (loaded before this file in index.html)
// and window.MR_ONE_CLOUD_CONFIG (cloud/config.js, loaded before this file).
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

  window.MRCloud = window.MRCloud || {};
  window.MRCloud.getClient = getClient;
  window.MRCloud.isEnabled = () => Boolean(cfg.enabled);
})();
