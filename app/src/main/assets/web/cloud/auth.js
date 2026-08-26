// MR-One cloud — auth. Depends on cloud/supabase-client.js loaded first.
(function () {
  'use strict';
  let currentSession = null;
  const listeners = [];

  function onAuthChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach((fn) => { try { fn(currentSession); } catch (e) { console.error(e); } }); }

  async function init() {
    const client = window.MRCloud.getClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentSession = data?.session || null;
    client.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      notify();
    });
    notify();
    return currentSession;
  }

  async function sendEmailOtp(email) {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
    const { data, error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true }
    });
    if (error) throw error;
    return data;
  }

  async function verifyEmailOtp(email, token) {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedToken = String(token || '').replace(/\D/g, '');
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
    if (!/^\d{6}$/.test(normalizedToken)) throw new Error('Enter the 6-digit login code.');
    const { data, error } = await client.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email'
    });
    if (error) throw error;
    currentSession = data?.session || null;
    notify();
    return data;
  }

  // Password auth remains as an optional fallback for existing accounts.
  async function signUp(email, password) {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentSession = data.session;
    notify();
    return data;
  }

  async function signOut() {
    const client = window.MRCloud.getClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    currentSession = null;
    notify();
  }

  function getUserId() { return currentSession?.user?.id || null; }
  function getUserEmail() { return currentSession?.user?.email || null; }
  function isSignedIn() { return Boolean(currentSession?.user?.id); }

  window.MRCloud = window.MRCloud || {};
  Object.assign(window.MRCloud, {
    authInit: init,
    sendEmailOtp,
    verifyEmailOtp,
    signUp,
    signIn,
    signOut,
    getUserId,
    getUserEmail,
    isSignedIn,
    onAuthChange
  });
})();
