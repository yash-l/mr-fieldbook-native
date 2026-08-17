# MR One v1.8.2 — Field Reliability, Accessibility & Render-safe Web Boot

- Fixed remaining theme leaks for note/search/lookup/schedule/day controls using semantic theme surfaces.
- Enforced 44px minimum interactive targets and larger field-safe text for critical small labels/actions.
- Added accessibility hardening: dialog labelling, search labels, nav current-state, import live status, icon close label, dynamic accessibility pass after render.
- Hardened import parsing with expanded mobile aliases, separate city vs area, mobile validation, PTS bounds, meeting-window validation, skipped-sheet/row reasons, import warning history, and conservative near-duplicate doctor matching.
- Added import aliases for speciality, C/NC, potential, input date, DM/RM last visit and common focused-brand columns.
- Made boot fault-tolerant: first render happens before deferred seed work; boot errors show a retry banner without deleting local data; runtime/unhandled promise errors are logged.
- Added a service worker for web/offline shell caching.
- Added Render Blueprint static-site deployment. Static hosting avoids web-service cold boot/spin-down architecture for the frontend.
- Android versionCode 182 / versionName 1.8.2.
