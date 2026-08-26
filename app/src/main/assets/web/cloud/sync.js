// MR-One cloud — offline-first sync.
//
// Local storage stays the primary, always-available store (per the brief:
// "do not replace local storage completely"). This module only ever runs
// AFTER a local save has already succeeded. The flow per the brief:
//
//   save locally immediately -> mark pending -> if online, push -> pull ->
//   merge -> mark synced
//
// A bad or missing network never blocks doctor entry: every function here
// is wrapped so a failure just leaves state.cloudSync.pending = true and
// tries again on the next trigger (debounced local save, "Sync now" tap,
// or the browser's `online` event).
(function () {
  'use strict';

  function stableId(prefix, obj) {
    if (obj && obj.id) return String(obj.id);
    // deterministic fallback for local records that were never given an id
    // (e.g. thirtyDayPlan entries, older imports/business rows) — same content
    // always produces the same cloud row id, so repeated syncs never duplicate.
    let str;
    try { str = JSON.stringify(obj); } catch (_) { str = String(obj); }
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return `${prefix}_${(h >>> 0).toString(36)}`;
  }

  // local state field -> { table, toRow(localRecord) -> cloud row, fromRow(cloudRow) -> local record, extra(local, cloud) }
  const TABLES = [
    {
      key: 'doctors', table: 'doctors',
      toRow: (d) => ({
        id: d.id, name: d.name, hospital_name: d.hospital || d.hospitalName || '',
        speciality: d.speciality || d.specialty || '',
        core_category: ['C', 'NC'].includes(String(d.coreCategory || '').toUpperCase()) ? String(d.coreCategory).toUpperCase() : null,
        area: d.area || '', mobile: d.mobile || '',
        monthly_visit_target: d.monthlyVisitTarget ? Number(d.monthlyVisitTarget) : null,
        min_visit_gap_days: d.minVisitGapDays != null ? Number(d.minVisitGapDays) : null,
        meeting_days: d.meetingDays || null, product_focus: d.productFocus || null,
        gps: (d.latitude || d.longitude) ? { latitude: d.latitude, longitude: d.longitude } : null,
        raw: d, updated_at: d.updatedAt || new Date().toISOString()
      }),
      fromRow: (r) => ({ ...(r.raw || {}), id: r.id, updatedAt: r.updated_at })
    },
    {
      key: 'chemists', table: 'pharmacies',
      toRow: (c) => ({
        id: c.id, name: c.name, area: c.area || '', mobile: c.mobile || '',
        gps: (c.latitude || c.longitude) ? { latitude: c.latitude, longitude: c.longitude } : null,
        raw: c, updated_at: c.updatedAt || new Date().toISOString()
      }),
      fromRow: (r) => ({ ...(r.raw || {}), id: r.id, updatedAt: r.updated_at })
    },
    {
      key: 'doctorNotes', table: 'doctor_notes',
      toRow: (n) => ({ id: n.id, doctor_id: n.doctorId, date: n.date || null, note: n.note, created_at: n.createdAt, updated_at: n.updatedAt || n.createdAt || new Date().toISOString() }),
      fromRow: (r) => ({ id: r.id, doctorId: r.doctor_id, date: r.date, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at })
    },
    {
      key: 'doctorPrescriptions', table: 'doctor_prescriptions',
      toRow: (n) => ({ id: n.id, doctor_id: n.doctorId, date: n.date || null, products: n.products || [], created_at: n.createdAt, updated_at: n.updatedAt || n.createdAt || new Date().toISOString() }),
      fromRow: (r) => ({ id: r.id, doctorId: r.doctor_id, date: r.date, products: r.products || [], createdAt: r.created_at, updatedAt: r.updated_at })
    },
    {
      key: 'pharmacyProducts', table: 'pharmacy_products',
      toRow: (p) => ({ id: p.id, pharmacy_id: p.chemistId, product: p.product, available: Boolean(p.available), qty: Number(p.qty) || 0, notes: p.notes || '', last_checked_date: p.lastCheckedDate || null, updated_at: p.updatedAt || new Date().toISOString() }),
      fromRow: (r) => ({ id: r.id, chemistId: r.pharmacy_id, product: r.product, available: r.available, qty: r.qty, notes: r.notes, lastCheckedDate: r.last_checked_date, updatedAt: r.updated_at })
    },
    {
      key: 'visits', table: 'visits',
      toRow: (v) => ({
        id: v.id, entity_type: v.entityType || (v.doctorId ? 'doctor' : v.chemistId ? 'chemist' : null),
        entity_id: v.entityId || v.doctorId || v.chemistId || null,
        date: v.date || null, status: v.status || null, raw: v,
        updated_at: v.updatedAt || v.createdAt || new Date().toISOString()
      }),
      fromRow: (r) => ({ ...(r.raw || {}), id: r.id, updatedAt: r.updated_at })
    },
    {
      key: 'patchPlans', table: 'patches',
      toRow: (p) => ({ id: p.id, date: p.date || null, status: p.status || null, items: p.items || [], updated_at: p.updatedAt || p.createdAt || new Date().toISOString() }),
      fromRow: (r) => ({ id: r.id, date: r.date, status: r.status, items: r.items || [], createdAt: r.created_at, updatedAt: r.updated_at })
    },
    {
      key: 'thirtyDayPlan', table: 'plans',
      toRow: (p) => ({ id: stableId('plan', { date: p.date }), date: p.date || null, items: p.items || [], generated_at: p.generatedAt || null, updated_at: p.updatedAt || new Date().toISOString() }),
      fromRow: (r) => ({ date: r.date, weekday: r.date ? new Date(`${r.date}T00:00:00`).getDay() : 0, items: r.items || [] })
    },
    {
      key: '__monthlyBusiness', table: 'monthly_business', // synthetic combined key — see push/pull overrides below
      toRow: (m) => ({ id: m.id, kind: m.kind, period: m.period || '', raw: m.raw, updated_at: m.updatedAt || new Date().toISOString() }),
      fromRow: (r) => ({ ...(r.raw || {}), id: r.id, kind: r.kind, period: r.period, updatedAt: r.updated_at })
    },
    {
      key: 'imports', table: 'imports',
      toRow: (i) => ({ id: stableId('import', i), source: i.source || i.fileName || i.type || '', summary: i, created_at: i.createdAt || i.date || new Date().toISOString() }),
      fromRow: (r) => ({ ...(r.summary || {}), id: r.id, createdAt: r.created_at })
    }
  ];

  // salesMonths and weeklyBusiness are two separate local arrays that share one cloud
  // table (kept distinct there only by the `kind` column) — handled with small wrapper
  // specs instead of forcing them into the generic one-array-per-table shape above.
  function businessRows(state) {
    const sales = (state.salesMonths || []).map((m) => ({ id: stableId('sm', m), kind: 'sales_month', period: m.month || m.period || '', raw: m, updatedAt: m.updatedAt }));
    const weekly = (state.weeklyBusiness || []).map((m) => ({ id: stableId('wk', m), kind: 'weekly_business', period: m.week || m.period || '', raw: m, updatedAt: m.updatedAt }));
    return [...sales, ...weekly];
  }
  function applyBusinessRows(state, merged) {
    state.salesMonths = window.MRCloud.mergeById(state.salesMonths || [], merged.filter((m) => m.kind === 'sales_month').map((m) => ({ ...(m.raw || {}), id: m.id, updatedAt: m.updatedAt })));
    state.weeklyBusiness = window.MRCloud.mergeById(state.weeklyBusiness || [], merged.filter((m) => m.kind === 'weekly_business').map((m) => ({ ...(m.raw || {}), id: m.id, updatedAt: m.updatedAt })));
  }

  function label() {
    try { return `${navigator.platform || 'device'}-${(navigator.userAgent || '').slice(-24)}`; } catch (_) { return 'unknown-device'; }
  }

  async function logSync(client, userId, direction, tableName, rowCount, status, detail) {
    try {
      await client.from('sync_log').insert({ user_id: userId, device_label: label(), direction, table_name: tableName, row_count: rowCount, status, detail: detail ? String(detail).slice(0, 500) : null });
    } catch (_) { /* logging failure should never block sync itself */ }
  }

  // Push every local row for one table (upsert by id). Safe to call repeatedly.
  async function pushTable(client, userId, state, spec) {
    const localRows = spec.key === '__monthlyBusiness' ? businessRows(state) : (state[spec.key] || []);
    const rows = localRows.map(spec.toRow).map((r) => ({ ...r, user_id: userId }));
    if (!rows.length) return { pushed: 0 };
    const { error } = await client.from(spec.table).upsert(rows, { onConflict: 'id' });
    await logSync(client, userId, 'push', spec.table, rows.length, error ? 'error' : 'ok', error?.message);
    if (error) throw error;
    return { pushed: rows.length };
  }

  // Pull rows changed since the last successful sync and merge into local state.
  async function pullTable(client, userId, state, spec, sinceIso) {
    let query = client.from(spec.table).select('*').eq('user_id', userId);
    if (sinceIso) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query;
    await logSync(client, userId, 'pull', spec.table, data?.length || 0, error ? 'error' : 'ok', error?.message);
    if (error) throw error;
    if (!data || !data.length) return { pulled: 0 };
    const remoteAsLocal = data.map(spec.fromRow);
    if (spec.key === '__monthlyBusiness') {
      const merged = window.MRCloud.mergeById(businessRows(state), remoteAsLocal.map((m) => ({ ...m, id: m.id })));
      applyBusinessRows(state, merged);
    } else {
      state[spec.key] = window.MRCloud.mergeById(state[spec.key] || [], remoteAsLocal);
    }
    return { pulled: data.length };
  }

  // user_settings is a single row per account (profile/settings/feature flags/custom
  // filters), not a list of records — plain last-write-wins on the whole blob rather
  // than per-id merge. Pushed every sync; only re-applied on pull if the remote copy
  // is strictly newer than the value we last pushed or pulled ourselves, so a device
  // doesn't immediately overwrite the change it just made with its own echo.
  async function pushUserSettings(client, userId, state) {
    const blob = { profile: state.profile, settings: state.settings, featureFlags: state.featureFlags, filtersConfig: state.filtersConfig, opening: state.opening };
    const ts = new Date().toISOString();
    const { error } = await client.from('user_settings').upsert({ user_id: userId, blob, updated_at: ts }, { onConflict: 'user_id' });
    await logSync(client, userId, 'push', 'user_settings', 1, error ? 'error' : 'ok', error?.message);
    if (error) throw error;
    state.cloudSync = state.cloudSync || {};
    state.cloudSync.settingsUpdatedAt = ts;
  }
  async function pullUserSettings(client, userId, state) {
    const { data, error } = await client.from('user_settings').select('*').eq('user_id', userId);
    await logSync(client, userId, 'pull', 'user_settings', data?.length || 0, error ? 'error' : 'ok', error?.message);
    if (error) throw error;
    const row = data && data[0];
    if (!row || !row.blob) return;
    const remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const knownTs = state.cloudSync?.settingsUpdatedAt ? new Date(state.cloudSync.settingsUpdatedAt).getTime() : 0;
    if (remoteTs > knownTs) {
      state.profile = { ...state.profile, ...(row.blob.profile || {}) };
      state.settings = { ...state.settings, ...(row.blob.settings || {}) };
      state.featureFlags = { ...state.featureFlags, ...(row.blob.featureFlags || {}) };
      state.filtersConfig = row.blob.filtersConfig || state.filtersConfig;
      state.opening = { ...state.opening, ...(row.blob.opening || {}) };
      state.cloudSync = state.cloudSync || {};
      state.cloudSync.settingsUpdatedAt = row.updated_at;
    }
  }

  let syncing = false;
  let debounceTimer = null;

  async function syncNow(getState, onStateChanged) {
    if (syncing) return { skipped: 'already syncing' };
    if (!navigator.onLine) return { skipped: 'offline' };
    const client = window.MRCloud.getClient();
    if (!client || !window.MRCloud.isSignedIn()) return { skipped: 'not signed in' };
    const userId = window.MRCloud.getUserId();
    syncing = true;
    const state = getState();
    state.cloudSync = state.cloudSync || { lastSyncedAt: '', pending: false, lastError: '' };
    const sinceIso = state.cloudSync.lastSyncedAt || null;
    const report = { pushed: {}, pulled: {}, errors: [] };
    try {
      // user_settings is a SINGLE shared row, unlike the per-id tables above — pull it
      // down and apply it before pushing, or a device with stale/empty local settings
      // would silently overwrite another device's genuinely newer settings the moment
      // it synced. (Caught by sync-coverage-verify.js during testing — do not reorder.)
      try { await pullUserSettings(client, userId, state); }
      catch (e) { report.errors.push(`pull user_settings: ${e.message}`); }
      for (const spec of TABLES) {
        try { const r = await pushTable(client, userId, state, spec); report.pushed[spec.table] = r.pushed; }
        catch (e) { report.errors.push(`push ${spec.table}: ${e.message}`); }
      }
      try { await pushUserSettings(client, userId, state); report.pushed.user_settings = 1; }
      catch (e) { report.errors.push(`push user_settings: ${e.message}`); }
      for (const spec of TABLES) {
        try { const r = await pullTable(client, userId, state, spec, sinceIso); report.pulled[spec.table] = r.pulled; }
        catch (e) { report.errors.push(`pull ${spec.table}: ${e.message}`); }
      }
      state.cloudSync.lastSyncedAt = new Date().toISOString();
      state.cloudSync.pending = report.errors.length > 0;
      state.cloudSync.lastError = report.errors.join(' | ');
    } finally {
      syncing = false;
      if (onStateChanged) onStateChanged(state, report);
    }
    return report;
  }

  // Call after every local save. Debounced so rapid local edits (typing,
  // multiple quick saves) don't fire a network round-trip per keystroke.
  function scheduleSync(getState, onStateChanged, delayMs = 4000) {
    if (!window.MRCloud.isEnabled() || !window.MRCloud.isSignedIn()) return;
    const state = getState();
    state.cloudSync = state.cloudSync || { lastSyncedAt: '', pending: false, lastError: '' };
    state.cloudSync.pending = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { syncNow(getState, onStateChanged); }, delayMs);
  }

  // One-time push of everything currently local, used right after first login.
  async function migrateLocalToCloud(getState, onStateChanged) {
    return syncNow(getState, onStateChanged);
  }

  window.MRCloud = window.MRCloud || {};
  Object.assign(window.MRCloud, { syncNow, scheduleSync, migrateLocalToCloud, TABLES });

  window.addEventListener('online', () => {
    if (window.MRCloud.pendingSyncTrigger) window.MRCloud.pendingSyncTrigger();
  });
})();
