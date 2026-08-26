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

  // Primary auth: Supabase email + password.
  function validateCredentials(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
    if (String(password || '').length < 6) throw new Error('Password must be at least 6 characters.');
    return { email: normalizedEmail, password: String(password) };
  }

  async function signUp(email, password) {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const credentials = validateCredentials(email, password);
    const { data, error } = await client.auth.signUp(credentials);
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const credentials = validateCredentials(email, password);
    const { data, error } = await client.auth.signInWithPassword(credentials);
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
    signUp,
    signIn,
    signOut,
    getUserId,
    getUserEmail,
    isSignedIn,
    onAuthChange
  });
})();
