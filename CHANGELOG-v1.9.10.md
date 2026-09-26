# v1.9.10 — Cloud sync now refreshes the screen after a pull

## Fixed: synced data not appearing until you switched tabs or reopened the app
Cloud sync itself was always working correctly — Supabase push/pull/merge, RLS,
and per-device auth were all fine. The bug was purely on the render side:

- `saveState(false)` is used after a background/cloud-triggered sync so it doesn't
  interrupt whatever you're actively editing. But it *also* skipped `renderAll()`
  entirely, so once a sync pulled in doctors/chemists/visits/etc. from another
  device, the already-open screen kept showing stale data — even though the
  correct data was sitting in `localStorage` the whole time.
- This showed up most on a second device/browser: sign in, "✓ Synced" appears in
  Super Admin, but the Doctors/Chemists list still looked empty until you
  navigated away and back or force-reloaded the app.

**Fix:** every sync path (initial sign-in pull, the online-reconnect trigger,
the debounced background sync after a local save, and the manual "Sync now" /
"Upload this device's data" buttons in Super Admin) now runs through a single
`onCloudSyncSettled(report)` helper. It always refreshes the Super Admin status
line, and additionally calls `renderAll()` whenever `report.pulled` shows the
sync actually brought rows down — so a real data pull always redraws the visible
screen, while a routine push-only sync still won't yank focus away from
something you're mid-edit on.

Changed files: `app/src/main/assets/web/app.js`, `app/src/main/assets/web/admin-cloud.js`.
No data model, schema, or Supabase table changes. No existing doctor, chemist,
visit, or settings data is touched.
