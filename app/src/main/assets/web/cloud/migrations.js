// MR-One cloud — first-login migration.
// Pushes everything already on this device up to Supabase exactly once per
// account, so a second phone signing into the same account starts with the
// first phone's data instead of an empty database.
(function () {
  'use strict';

  async function runFirstLoginMigrationIfNeeded(getState, onStateChanged) {
    const state = getState();
    state.cloudSync = state.cloudSync || { lastSyncedAt: '', pending: false, lastError: '', migratedAt: '' };
    if (state.cloudSync.migratedAt) return { skipped: 'already migrated on this device' };
    const report = await window.MRCloud.migrateLocalToCloud(getState, onStateChanged);
    if (!report.skipped) {
      state.cloudSync.migratedAt = new Date().toISOString();
      if (onStateChanged) onStateChanged(state, report);
    }
    return report;
  }

  window.MRCloud = window.MRCloud || {};
  window.MRCloud.runFirstLoginMigrationIfNeeded = runFirstLoginMigrationIfNeeded;
})();
