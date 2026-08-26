// MR-One Super Admin — RBAC (PIN unlock), feature flags, doctor filters manager,
// visit frequency policy, and backup/restore.
//
// Phase 2 (architecture cleanup) extraction #4. This module now OWNS `adminUnlocked` —
// it was only ever read/written from within this code even before extraction (verified
// by grep before moving anything). That makes this the natural, safe boundary: nothing
// outside this module needs to touch the unlock flag directly, only ask it a yes/no
// question via isUnlocked().
//
// One real wrinkle worth documenting: this module calls renderSchemaPanel() and
// renderCloudSyncPanel() (owned by admin-cloud.js), while admin-cloud.js needs to ask
// THIS module whether Super Admin is unlocked. That's a genuine circular dependency
// between the two extracted modules. It's resolved in app.js (the composition root)
// with a lazy reference — admin-cloud.js is handed a function that looks up this
// module's isUnlocked() at call time, not at wiring time, so the initialization order
// of the two init() calls doesn't matter. See app.js for exactly how that's wired.
(function () {
  'use strict';
  let deps = null;
  let adminUnlocked = false;

  function isUnlocked() { return adminUnlocked; }

  function renderAdminBody() {
    const { getState, esc, empty, clean, num, featureOn, FEATURE_CATALOG, verifyBackup, humanBytes, renderSchemaPanel, renderCloudSyncPanel } = deps;
    const state = getState();
    const hasPin = Boolean(state.admin?.pinHash);
    if (!hasPin) {
      return `<div class="form-card"><div class="form-title"><h2>Set Super Admin PIN</h2><p>Protects feature flags, filters and destructive controls. Separate from your app unlock PIN.</p></div><form id="setAdminPinForm" class="sheet-form"><div class="field-grid two"><label><span>New PIN</span><input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="6"></label><label><span>Confirm PIN</span><input name="confirmPin" type="password" inputmode="numeric" minlength="4" maxlength="6"></label></div><button class="btn primary full" type="submit">Set Super Admin PIN</button></form></div>`;
    }
    if (!adminUnlocked) {
      return `<div class="lock-card" style="margin:20px auto"><div class="brand-mark large">SA</div><h1>Super Admin locked</h1><p>Enter Super Admin PIN to manage features, filters and data safety.</p><input id="adminUnlockPin" class="pin-input" inputmode="numeric" maxlength="6" placeholder="••••"><button id="adminUnlockBtn" class="btn primary full" type="button">Unlock</button><p id="adminUnlockError" class="error-text"></p></div>`;
    }
    const featuresHtml = FEATURE_CATALOG.map(([k, label]) => `<div class="toggle-line" style="justify-content:space-between;margin-bottom:8px"><span>${esc(label)}</span><label style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" data-toggle-feature="${esc(k)}" ${featureOn(k) ? 'checked' : ''}></label></div>`).join('');
    const filters = state.filtersConfig?.doctors || [];
    const filtersHtml = filters.length ? filters.map((f) => `<div class="import-item"><div><strong>${esc(f.label)}</strong><small>field=${esc(f.field)} • ${esc(f.op)}${f.op !== 'not_empty' ? ` "${esc(f.value)}"` : ''}</small></div><button data-remove-filter="${esc(f.id)}" class="tag bad" style="border:0;cursor:pointer">Remove</button></div>`).join('') : empty('No custom doctor filters yet.');
    const backups = (state.backupHistory || []).slice(0, 8);
    const backupsHtml = backups.length ? backups.map((b, i) => { const check = verifyBackup(b); return `<div class="import-item"><div><strong>${esc(b.kind)} • ${esc(new Date(b.ts).toLocaleString('en-IN'))}</strong><small>${esc(humanBytes(b.sizeBytes))} • ${check.ok ? '✓ verified' : '⚠ ' + esc(check.reason)}</small></div><button data-restore-backup="${i}" class="tag" style="border:0;cursor:pointer">Restore</button></div>`; }).join('') : empty('No snapshots yet — one is taken automatically each day and before risky operations (import, migration, reset).');
    return `
    <div class="form-card"><div class="form-title"><h2>RBAC status</h2><p>Unlocked for this session only; locks again on app restart or when you tap Lock. This is a local offline app — the PIN gates the controls below in-app; it is not a server-enforced permission boundary.</p></div><button id="adminLockBtn" class="btn secondary">Lock now</button></div>
    ${renderSchemaPanel()}
    ${renderCloudSyncPanel()}
    <div class="form-card"><div class="form-title"><h2>Visit frequency policy</h2><p>CORE doctors are auto-scheduled more often than NON-CORE across every planning tool. Applies to any doctor without a manual override on their profile.</p></div>
    <form id="visitPolicyForm" class="sheet-form"><div class="field-grid two"><label><span>CORE — meetings / month</span><select name="coreMonthlyTarget"><option value="2" ${num(state.settings.coreMonthlyTarget) === 2 ? 'selected' : ''}>Twice (2×)</option><option value="3" ${num(state.settings.coreMonthlyTarget) !== 2 ? 'selected' : ''}>Thrice (3×)</option></select></label><label><span>NON-CORE — meetings / month</span><select name="nonCoreMonthlyTarget"><option value="1" selected>Once (1×)</option></select></label></div><button class="btn primary full" type="submit">Save policy</button></form></div>
    <div class="form-card"><div class="form-title"><h2>Feature control</h2><p>Add / remove visibility of app features instantly across the whole app.</p></div>${featuresHtml}</div>
    <div class="form-card"><div class="form-title"><h2>Doctor filters manager</h2><p>Add or remove custom quick-filter chips shown on the Doctors list.</p></div>
    <form id="addFilterForm" class="sheet-form"><div class="field-grid two"><label><span>Chip label</span><input name="label" placeholder="e.g. High Potential" required></label><label><span>Doctor field</span><select name="field"><option value="coreCategory">CORE / NON-CORE</option><option value="speciality">Speciality</option><option value="productFocus">Focused brand</option><option value="area">Area</option></select></label></div><div class="field-grid two"><label><span>Match</span><select name="op"><option value="equals">Equals</option><option value="contains">Contains</option><option value="not_empty">Not empty</option></select></label><label><span>Value</span><input name="value" placeholder="Value to match"></label></div><button class="btn primary full" type="submit">Add filter</button></form>
    <div style="margin-top:10px">${filtersHtml}</div></div>
    <div class="form-card"><div class="form-title"><h2>Data safety & backup</h2><p>Automatic daily snapshot + a snapshot before every import, migration and reset. Each snapshot is checksum-verified.</p></div><button id="manualSnapshotBtn" class="btn primary">Create backup now</button><div style="margin-top:10px">${backupsHtml}</div></div>
    <div class="danger-card"><div><h3>Remove Super Admin PIN</h3><p>Removes the admin gate. Current feature/filter settings stay as-is.</p></div><button id="removeAdminPinBtn" class="btn danger compact">Remove</button></div>
    `;
  }

  function bindAdminEvents() {
    const { getState, saveState, toast, $, $$, clean, num, uid, hashPin, applyFeatureVisibility, snapshotBackup, restoreFromSnapshot, navigate, renderAdmin } = deps;
    const state = getState();
    $('#setAdminPinForm')?.addEventListener('submit', async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), p = clean(fd.get('pin')), c = clean(fd.get('confirmPin')); if (!/^\d{4,6}$/.test(p) || p !== c) { toast('PIN must be matching 4–6 digits.'); return; } state.admin.pinHash = await hashPin(p); saveState(false); adminUnlocked = true; renderAdmin(); toast('Super Admin PIN set. Unlocked for this session.'); });
    $('#adminUnlockBtn')?.addEventListener('click', async () => { const h = await hashPin($('#adminUnlockPin').value); if (h === state.admin.pinHash) { adminUnlocked = true; renderAdmin(); } else { const err = $('#adminUnlockError'); if (err) err.textContent = 'Wrong PIN'; } });
    $('#adminUnlockPin')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#adminUnlockBtn')?.click(); });
    $('#adminLockBtn')?.addEventListener('click', () => { adminUnlocked = false; renderAdmin(); });
    $('#removeAdminPinBtn')?.addEventListener('click', () => { if (!adminUnlocked) { toast('Unlock first.'); return; } if (!confirm('Remove Super Admin PIN?')) return; state.admin.pinHash = ''; adminUnlocked = false; saveState(false); renderAdmin(); toast('Super Admin PIN removed.'); });
    $('#visitPolicyForm')?.addEventListener('submit', (e) => { e.preventDefault(); if (!adminUnlocked) { toast('Unlock Super Admin first.'); return; } const fd = new FormData(e.currentTarget); state.settings.coreMonthlyTarget = num(fd.get('coreMonthlyTarget')) || 3; state.settings.nonCoreMonthlyTarget = num(fd.get('nonCoreMonthlyTarget')) || 1; saveState(false); toast(`CORE doctors now target ${state.settings.coreMonthlyTarget}× / month; NON-CORE ${state.settings.nonCoreMonthlyTarget}× / month.`); });
    $$('[data-toggle-feature]').forEach((cb) => cb.addEventListener('change', (e) => { if (!adminUnlocked) { e.target.checked = !e.target.checked; toast('Unlock Super Admin first.'); return; } state.featureFlags[e.target.dataset.toggleFeature] = e.target.checked; saveState(false); applyFeatureVisibility(); }));
    $('#addFilterForm')?.addEventListener('submit', (e) => { e.preventDefault(); if (!adminUnlocked) { toast('Unlock Super Admin first.'); return; } const fd = new FormData(e.currentTarget), label = clean(fd.get('label')); if (!label) { toast('Enter a chip label.'); return; } state.filtersConfig.doctors.push({ id: uid('filt'), label, field: fd.get('field'), op: fd.get('op'), value: clean(fd.get('value')) }); saveState(false); renderAdmin(); toast('Filter added — visible as a chip on Doctors.'); });
    $$('[data-remove-filter]').forEach((b) => b.addEventListener('click', () => { if (!adminUnlocked) { toast('Unlock Super Admin first.'); return; } state.filtersConfig.doctors = state.filtersConfig.doctors.filter((f) => f.id !== b.dataset.removeFilter); saveState(false); renderAdmin(); }));
    $('#manualSnapshotBtn')?.addEventListener('click', () => { if (!adminUnlocked) { toast('Unlock Super Admin first.'); return; } const r = snapshotBackup('manual'); saveState(false); renderAdmin(); toast(r ? 'Backup created and verified.' : 'Backup failed.'); });
    $$('[data-restore-backup]').forEach((b) => b.addEventListener('click', () => { if (!adminUnlocked) { toast('Unlock Super Admin first.'); return; } if (!confirm('Restore this backup? Current data will first be snapshotted, then replaced.')) return; try { const entry = (state.backupHistory || [])[Number(b.dataset.restoreBackup)]; restoreFromSnapshot(entry); toast('Backup restored.'); renderAdmin(); navigate('dashboard'); } catch (err) { toast(err.message); } }));
  }

  function init(injected) {
    deps = injected;
    return { renderAdminBody, bindAdminEvents, isUnlocked };
  }

  window.MRAdmin = { init };
})();
