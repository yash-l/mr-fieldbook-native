// MR-One Super Admin — Cloud sync panel + Versioning/schema panel.
//
// Phase 2 (architecture cleanup) extraction #3. Same dependency-injection pattern as
// planner.js and records.js. Note this deliberately does NOT take over `adminUnlocked`
// itself — that flag, and the rest of the admin panel (feature flags, filters, backup/
// restore, RBAC PIN), still live in app.js because they're threaded through the same
// `renderAdmin()` orchestrator this module also calls back into. Pulling every admin
// concern out in one pass would risk exactly the kind of half-migrated state bug this
// whole architecture phase exists to avoid — so this cut is deliberately just the two
// self-contained panels, not the whole Super Admin page.
(function () {
  'use strict';
  let deps = null;

  function renderSchemaPanel() {
    const { getState, esc, empty, appRelease, schemaVersion } = deps;
    const state = getState();
    const log = (state.migrationLog || []).slice().reverse();
    const logHtml = log.length
      ? log.map((l) => `<div class="import-item"><div><strong>v${esc(l.fromVersion)} → v${esc(l.toVersion)}</strong><small>${esc(new Date(l.appliedAt).toLocaleString('en-IN'))}</small></div>${l.snapshotKey ? `<button data-rollback-schema="${esc(l.snapshotKey)}" class="tag bad" style="border:0;cursor:pointer">Rollback</button>` : ''}</div>`).join('')
      : empty('No schema migrations have run on this device yet.');
    return `<div class="form-card"><div class="form-title"><h2>Versioning & data schema</h2><p>App ${esc(appRelease)} • Data schema v${esc(schemaVersion)}. Every schema upgrade snapshots your old data first — nothing is ever overwritten blindly, and any upgrade can be rolled back below.</p></div>${logHtml}</div>`;
  }

  function bindSchemaEvents() {
    const { $$, toast, isUnlocked, rollbackToPreMigrationSnapshot } = deps;
    $$('[data-rollback-schema]').forEach((b) => b.addEventListener('click', () => {
      if (!isUnlocked()) { toast('Unlock Super Admin first.'); return; }
      if (!confirm('Roll back to the data as it was right before this migration ran? Your current data will be snapshotted first so this is also reversible.')) return;
      try { rollbackToPreMigrationSnapshot(b.dataset.rollbackSchema); toast('Rolled back. Reloading…'); setTimeout(() => location.reload(), 600); }
      catch (err) { toast(err.message); }
    }));
  }

  function renderCloudSyncPanel() {
    const { getState, esc } = deps;
    const state = getState();
    const cloudReady = window.MRCloud?.isEnabled?.();
    if (!cloudReady) {
      return `<div class="form-card"><div class="form-title"><h2>Cloud sync</h2><p>Not configured yet. Add your Supabase project URL and anon key to <code>cloud/config.js</code>, then redeploy — see <code>supabase/README.md</code> for the full setup.</p></div></div>`;
    }
    const signedIn = window.MRCloud.isSignedIn();
    const sync = state.cloudSync || {};
    if (!signedIn) {
      return `<div class="form-card"><div class="form-title"><h2>Cloud sync — sign in</h2><p>Sign in to sync this device's doctors, chemists, records and plans to your account. Local data stays fully usable offline either way.</p></div>
      <form id="cloudAuthForm" class="sheet-form"><div class="field-grid two"><label><span>Email</span><input name="email" type="email" required></label><label><span>Password</span><input name="password" type="password" minlength="6" required></label></div><div class="tag-row"><button class="btn primary" type="submit" data-cloud-mode="signin">Sign in</button><button class="btn secondary" type="submit" data-cloud-mode="signup">Create account</button></div><p id="cloudAuthError" class="error-text"></p></form></div>`;
    }
    const statusLine = sync.pending ? `⏳ Sync pending${sync.lastError ? ` — last error: ${esc(sync.lastError)}` : ''}` : sync.lastSyncedAt ? `✓ Synced ${esc(new Date(sync.lastSyncedAt).toLocaleString('en-IN'))}` : 'Not synced yet';
    return `<div class="form-card"><div class="form-title"><h2>Cloud sync</h2><p>Signed in as ${esc(window.MRCloud.getUserEmail() || '')}. ${esc(statusLine)}</p></div>
    <div class="tag-row"><button id="cloudSyncNowBtn" class="btn primary">Sync now</button>${sync.migratedAt ? '' : `<button id="cloudMigrateBtn" class="btn secondary">Upload this device's data</button>`}<button id="cloudSignOutBtn" class="btn secondary">Sign out</button></div>
    ${sync.migratedAt ? `<small class="muted-line">Initial upload done ${esc(new Date(sync.migratedAt).toLocaleDateString('en-IN'))}.</small>` : `<small class="muted-line">Tap "Upload this device's data" once to push everything already on this phone to your account.</small>`}</div>`;
  }

  function renderAdminCloudStatus() {
    if (document.querySelector('[data-page="admin"]')?.classList.contains('active')) deps.renderAdmin();
  }

  function bindCloudSyncEvents() {
    const { $, getState, saveState, toast, clean, renderAdmin } = deps;
    const state = getState();
    $('#cloudAuthForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter || e.target.querySelector('button[type="submit"]');
      const mode = btn?.dataset.cloudMode || 'signin';
      const fd = new FormData(e.currentTarget), email = clean(fd.get('email')), password = fd.get('password');
      try {
        if (mode === 'signup') await window.MRCloud.signUp(email, password);
        else await window.MRCloud.signIn(email, password);
        renderAdmin();
        toast(mode === 'signup' ? 'Account created. Check your email if confirmation is required.' : 'Signed in.');
      } catch (err) { const el = $('#cloudAuthError'); if (el) el.textContent = err.message || 'Sign-in failed.'; }
    });
    $('#cloudSyncNowBtn')?.addEventListener('click', async () => {
      toast('Syncing…');
      const report = await window.MRCloud.syncNow(() => state, () => { saveState(false); });
      saveState(false); renderAdmin();
      toast(report.skipped ? `Sync skipped: ${report.skipped}` : report.errors?.length ? `Synced with ${report.errors.length} error(s).` : 'Synced.');
    });
    $('#cloudMigrateBtn')?.addEventListener('click', async () => {
      toast("Uploading this device's data…");
      const report = await window.MRCloud.runFirstLoginMigrationIfNeeded(() => state, () => { saveState(false); });
      saveState(false); renderAdmin();
      toast(report.skipped ? String(report.skipped) : 'Upload complete.');
    });
    $('#cloudSignOutBtn')?.addEventListener('click', async () => { await window.MRCloud.signOut(); renderAdmin(); toast('Signed out. Local data is unaffected.'); });
  }

  function init(injected) {
    deps = injected;
    return { renderSchemaPanel, bindSchemaEvents, renderCloudSyncPanel, renderAdminCloudStatus, bindCloudSyncEvents };
  }

  window.MRAdminCloud = { init };
})();
