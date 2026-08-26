// MR-One cloud config — PUBLIC frontend values only.
//
// Supabase Project URL + Publishable/legacy anon key may be configured either
// at build time below or from Super Admin > Cloud Configuration. Admin-entered
// values are stored only in this browser/WebView localStorage so secrets are
// never committed to Git. These values are public client credentials; RLS is
// the actual security boundary.
//
// NEVER store a service_role key or sb_secret_* key in this frontend.
(function () {
  'use strict';

  const STORAGE_KEY = 'mr-one-cloud-config-v1';
  const buildConfig = {
    supabaseUrl: '',
    supabaseAnonKey: ''
  };

  function clean(value) { return String(value == null ? '' : value).trim(); }

  function validate(url, key) {
    const u = clean(url).replace(/\/$/, '');
    const k = clean(key);
    const errors = [];
    if (!u) errors.push('Project URL is required.');
    else {
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'https:') errors.push('Project URL must use HTTPS.');
      } catch (_) { errors.push('Project URL is invalid.'); }
    }
    if (!k) errors.push('Publishable / anon key is required.');
    if (/^sb_secret_/i.test(k) || /service[_-]?role/i.test(k)) errors.push('Secret/service-role keys are forbidden in the app. Use a Publishable or legacy anon key only.');
    return { ok: errors.length === 0, errors, url: u, key: k };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }

  const local = loadLocal();
  const initial = validate(local.supabaseUrl || buildConfig.supabaseUrl, local.supabaseAnonKey || buildConfig.supabaseAnonKey);
  const cfg = window.MR_ONE_CLOUD_CONFIG = {
    supabaseUrl: initial.url,
    supabaseAnonKey: initial.key,
    enabled: initial.ok
  };

  function get() {
    return { supabaseUrl: cfg.supabaseUrl || '', supabaseAnonKey: cfg.supabaseAnonKey || '', enabled: Boolean(cfg.enabled) };
  }

  function set(url, key) {
    const checked = validate(url, key);
    if (!checked.ok) throw new Error(checked.errors.join(' '));
    cfg.supabaseUrl = checked.url;
    cfg.supabaseAnonKey = checked.key;
    cfg.enabled = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ supabaseUrl: checked.url, supabaseAnonKey: checked.key }));
    window.MRCloud?.resetClient?.();
    return get();
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    cfg.supabaseUrl = clean(buildConfig.supabaseUrl).replace(/\/$/, '');
    cfg.supabaseAnonKey = clean(buildConfig.supabaseAnonKey);
    cfg.enabled = validate(cfg.supabaseUrl, cfg.supabaseAnonKey).ok;
    window.MRCloud?.resetClient?.();
    return get();
  }

  window.MRCloudConfig = { get, set, clear, validate, storageKey: STORAGE_KEY };
})();
