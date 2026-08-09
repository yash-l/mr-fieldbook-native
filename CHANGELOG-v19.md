# MR FieldFlow v19 changelog

## Redesign
- Rebuilt Today screen around a single primary Doctor Visit flow.
- Added central Visit navigation action.
- Moved report/setup complexity below the daily work queue.
- Collapsed doctor master and GPS sections inside doctor calls.

## MR workflow
- Added chemist-only visit logging.
- Added field expense logging.
- Added day-close summary.
- Preserved POB/distributor, smart patch, route, nearby hospital, voice capture, follow-up, imports and reports.

## Stability
- Added last-good local state recovery.
- Added last-save timestamp.
- Added duplicate-submit protection to doctor visits and POB orders.
- Removed fake fresh-install call/opening figures.
- Removed automatic startup GPS.
- Added Android Back handling for SPA sheets/pages.
- Stops speech/GPS listeners when app pauses and destroys WebView cleanly.
- Disabled cleartext traffic.

## Compatibility
- Storage key remains `mr-daily-auto-v3`; v18 data migrates in place.
- Existing doctors, chemists, visits, orders, intelligence history, routes and reports remain supported.
