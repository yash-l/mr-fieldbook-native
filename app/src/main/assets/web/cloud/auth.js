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
    const { data } = await client.auth.getSession();
    currentSession = data?.session || null;
    client.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      notify();
    });
    notify();
    return currentSession;
  }

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


  function getOAuthRedirectUrl() {
    // Android APK runs from file:// and returns through our verified app-owned deep link.
    // Render/browser builds return to the same deployed page.
    if (location.protocol === 'file:') return 'mrone://auth/callback';
    return `${location.origin}${location.pathname}`;
  }

  async function signInWithGitHub() {
    const client = window.MRCloud.getClient();
    if (!client) throw new Error('Cloud sync is not configured yet.');
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: getOAuthRedirectUrl() }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const client = window.MRCloud.getClient();
    if (!client) return;
    await client.auth.signOut();
    currentSession = null;
    notify();
  }

  function getUserId() { return currentSession?.user?.id || null; }
  function getUserEmail() { return currentSession?.user?.email || null; }
  function isSignedIn() { return Boolean(currentSession?.user?.id); }

  window.MRCloud = window.MRCloud || {};
  Object.assign(window.MRCloud, {
    authInit: init, signUp, signIn, signInWithGitHub, signOut, getUserId, getUserEmail, isSignedIn, onAuthChange
  });
})();
