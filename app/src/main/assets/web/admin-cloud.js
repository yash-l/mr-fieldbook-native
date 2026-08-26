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
    const config = window.MRCloudConfig?.get?.() || window.MR_ONE_CLOUD_CONFIG || {};
    const cloudReady = window.MRCloud?.isEnabled?.();
    const keyHint = config.supabaseAnonKey ? `${String(config.supabaseAnonKey).slice(0, 12)}••••${String(config.supabaseAnonKey).slice(-6)}` : 'Not saved';
    const configCard = `<div class="form-card"><div class="form-title"><h2>Cloud Configuration</h2><p>Configure Supabase without editing source files. Values are stored only on this device/browser. Use Project URL + Publishable key (<code>sb_publishable_…</code>) or legacy anon key. Never use <code>sb_secret_…</code> or <code>service_role</code>.</p></div>
      <form id="cloudConfigForm" class="sheet-form">
        <label><span>Supabase Project URL</span><input name="supabaseUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://your-project.supabase.co" value="${esc(config.supabaseUrl || '')}" required></label>
        <label><span>Publishable / anon key</span><div style="display:flex;gap:8px;align-items:center"><input id="cloudKeyInput" name="supabaseAnonKey" type="password" autocomplete="off" spellcheck="false" placeholder="sb_publishable_…" value="${esc(config.supabaseAnonKey || '')}" required style="flex:1"><button id="toggleCloudKeyBtn" class="btn secondary compact" type="button" aria-label="Show or hide Supabase key">Show</button></div><small class="muted-line">Saved key: ${esc(keyHint)}</small></label>
        <div class="tag-row"><button id="testCloudConfigBtn" class="btn secondary" type="button">Test connection</button><button class="btn primary" type="submit">Save &amp; enable cloud</button>${config.supabaseUrl || config.supabaseAnonKey ? '<button id="clearCloudConfigBtn" class="btn danger" type="button">Clear</button>' : ''}</div>
        <p id="cloudConfigStatus" class="muted-line" role="status" aria-live="polite">${cloudReady ? '✓ Cloud credentials configured on this device.' : 'Cloud credentials not configured yet.'}</p>
      </form></div>`;
    if (!cloudReady) {
      return `${configCard}<div class="form-card"><div class="form-title"><h2>Cloud sync</h2><p>After saving valid credentials above, sign in here and sync this device. Before first use, run <code>supabase/schema.sql</code> once in the Supabase SQL Editor.</p></div></div>`;
    }
    const signedIn = window.MRCloud.isSignedIn();
    const sync = state.cloudSync || {};
    if (!signedIn) {
      return `${configCard}<div class="form-card cloud-auth-card"><div class="form-title"><h2>Cloud sync — Email OTP</h2><p>No password required. Enter your email, receive a 6-digit code, verify it, then sync this device.</p></div>
      <form id="cloudOtpForm" class="sheet-form" novalidate>
        <label><span>Email</span><input id="cloudOtpEmail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></label>
        <div class="tag-row"><button id="cloudSendOtpBtn" class="btn primary" type="button">Send login code</button></div>
        <div id="cloudOtpVerifyArea" class="cloud-otp-verify hidden">
          <label><span>6-digit login code</span><input id="cloudOtpCode" name="otp" class="otp-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" aria-describedby="cloudOtpHelp"></label>
          <small id="cloudOtpHelp" class="muted-line">Enter the code sent by Supabase to your email.</small>
          <div class="tag-row"><button id="cloudVerifyOtpBtn" class="btn primary" type="button">Verify &amp; sign in</button><button id="cloudResendOtpBtn" class="btn secondary" type="button">Resend code</button></div>
        </div>
      </form>
      <details class="cloud-email-fallback"><summary>Use email &amp; password instead</summary><form id="cloudAuthForm" class="sheet-form"><div class="field-grid two"><label><span>Email</span><input name="email" type="email" autocomplete="email" required></label><label><span>Password</span><input name="password" type="password" autocomplete="current-password" minlength="6" required></label></div><div class="tag-row"><button class="btn secondary" type="submit" data-cloud-mode="signin">Sign in</button><button class="btn secondary" type="submit" data-cloud-mode="signup">Create account</button></div></form></details>
      <p id="cloudAuthError" class="error-text" role="alert" aria-live="assertive"></p></div>`;
    }
    const statusLine = sync.pending ? `⏳ Sync pending${sync.lastError ? ` — last error: ${esc(sync.lastError)}` : ''}` : sync.lastSyncedAt ? `✓ Synced ${esc(new Date(sync.lastSyncedAt).toLocaleString('en-IN'))}` : 'Not synced yet';
    return `${configCard}<div class="form-card"><div class="form-title"><h2>Cloud sync</h2><p>Signed in as ${esc(window.MRCloud.getUserEmail() || '')}. ${esc(statusLine)}</p></div>
    <div class="tag-row"><button id="cloudSyncNowBtn" class="btn primary">Sync now</button>${sync.migratedAt ? '' : `<button id="cloudMigrateBtn" class="btn secondary">Upload this device's data</button>`}<button id="cloudSignOutBtn" class="btn secondary">Sign out</button></div>
    ${sync.migratedAt ? `<small class="muted-line">Initial upload done ${esc(new Date(sync.migratedAt).toLocaleDateString('en-IN'))}.</small>` : `<small class="muted-line">Tap "Upload this device's data" once to push everything already on this phone to your account.</small>`}</div>`;
  }

  function renderAdminCloudStatus() {
    if (document.querySelector('[data-page="admin"]')?.classList.contains('active')) deps.renderAdmin();
  }

  async function testCloudCredentials(url, key) {
    const checked = window.MRCloudConfig?.validate?.(url, key);
    if (!checked?.ok) throw new Error((checked?.errors || ['Invalid cloud configuration.']).join(' '));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${checked.url}/auth/v1/settings`, {
        method: 'GET',
        headers: { apikey: checked.key },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.json())?.msg || ''; } catch (_) {}
        throw new Error(`Supabase rejected these credentials (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`);
      }
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error('Connection timed out. Check internet and Project URL.');
      throw err;
    } finally { clearTimeout(timer); }
  }

  function bindCloudSyncEvents() {
    const { $, getState, saveState, toast, clean, renderAdmin } = deps;
    const state = getState();

    $('#toggleCloudKeyBtn')?.addEventListener('click', () => {
      const input = $('#cloudKeyInput');
      const btn = $('#toggleCloudKeyBtn');
      if (!input || !btn) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide Supabase key' : 'Show Supabase key');
    });

    $('#testCloudConfigBtn')?.addEventListener('click', async () => {
      const form = $('#cloudConfigForm');
      const status = $('#cloudConfigStatus');
      if (!form || !status) return;
      const fd = new FormData(form);
      const url = clean(fd.get('supabaseUrl'));
      const key = clean(fd.get('supabaseAnonKey'));
      status.textContent = 'Testing Supabase connection…';
      try {
        await testCloudCredentials(url, key);
        status.textContent = '✓ Connection successful. Credentials are valid.';
        toast('Supabase connection successful.');
      } catch (err) {
        status.textContent = `⚠ ${err.message || 'Connection failed.'}`;
        toast(err.message || 'Supabase connection failed.');
      }
    });

    $('#cloudConfigForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!deps.isUnlocked()) { toast('Unlock Super Admin first.'); return; }
      const status = $('#cloudConfigStatus');
      const fd = new FormData(e.currentTarget);
      const url = clean(fd.get('supabaseUrl'));
      const key = clean(fd.get('supabaseAnonKey'));
      try {
        status.textContent = 'Validating and testing…';
        await testCloudCredentials(url, key);
        window.MRCloudConfig.set(url, key);
        await window.MRCloud.authInit?.();
        toast('Cloud configuration saved and enabled on this device.');
        renderAdmin();
      } catch (err) {
        status.textContent = `⚠ ${err.message || 'Could not save cloud configuration.'}`;
        toast(err.message || 'Could not save cloud configuration.');
      }
    });

    $('#clearCloudConfigBtn')?.addEventListener('click', async () => {
      if (!deps.isUnlocked()) { toast('Unlock Super Admin first.'); return; }
      if (!confirm('Clear Supabase configuration from this device? Local MR data will not be deleted.')) return;
      try { await window.MRCloud.signOut?.(); } catch (_) {}
      window.MRCloudConfig?.clear?.();
      toast('Cloud configuration cleared. Local data is unchanged.');
      renderAdmin();
    });
    let otpSending = false;
    async function sendOtpCode() {
      if (otpSending) return;
      const emailInput = $('#cloudOtpEmail');
      const verifyArea = $('#cloudOtpVerifyArea');
      const errorEl = $('#cloudAuthError');
      const email = clean(emailInput?.value || '');
      if (errorEl) errorEl.textContent = '';
      try {
        otpSending = true;
        $('#cloudSendOtpBtn')?.setAttribute('disabled', 'disabled');
        $('#cloudResendOtpBtn')?.setAttribute('disabled', 'disabled');
        toast('Sending login code…');
        await window.MRCloud.sendEmailOtp(email);
        verifyArea?.classList.remove('hidden');
        $('#cloudOtpCode')?.focus();
        toast('Login code sent. Check your email.');
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || 'Could not send login code.';
        toast(err.message || 'Could not send login code.');
      } finally {
        otpSending = false;
        $('#cloudSendOtpBtn')?.removeAttribute('disabled');
        $('#cloudResendOtpBtn')?.removeAttribute('disabled');
      }
    }

    $('#cloudSendOtpBtn')?.addEventListener('click', sendOtpCode);
    $('#cloudResendOtpBtn')?.addEventListener('click', sendOtpCode);
    $('#cloudOtpEmail')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendOtpCode(); } });
    $('#cloudOtpCode')?.addEventListener('input', (e) => { e.currentTarget.value = String(e.currentTarget.value || '').replace(/\D/g, '').slice(0, 6); });
    $('#cloudOtpCode')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#cloudVerifyOtpBtn')?.click(); } });
    $('#cloudVerifyOtpBtn')?.addEventListener('click', async () => {
      const errorEl = $('#cloudAuthError');
      const email = clean($('#cloudOtpEmail')?.value || '');
      const token = clean($('#cloudOtpCode')?.value || '');
      const btn = $('#cloudVerifyOtpBtn');
      try {
        if (errorEl) errorEl.textContent = '';
        btn?.setAttribute('disabled', 'disabled');
        toast('Verifying code…');
        await window.MRCloud.verifyEmailOtp(email, token);
        renderAdmin();
        toast('Cloud sign-in successful.');
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || 'Code verification failed.';
        toast(err.message || 'Code verification failed.');
      } finally {
        btn?.removeAttribute('disabled');
      }
    });
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
