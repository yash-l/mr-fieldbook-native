# Validation — MR One v1.3.0

## Static checks required before delivery
- JavaScript syntax: app.js + seed-data.js.
- Android XML + web manifest JSON parse.
- GitHub Actions YAML parse.
- No duplicate static HTML ids.
- Android namespace/applicationId/package declarations all `com.mrone.fieldapp`.
- versionCode 130 / versionName 1.3.0.
- SAN pending-text delivery method remains present.
- Doctor-will-call reminder + conversion functions present.
- Timing/type/area filters, Google search, locality inference and 50 m proximity prompt present.
- Old backup JSON parses and remains external to the public source package.
- ZIP integrity test.

## Performance architecture
- `saveState()` no longer renders every hidden page.
- Navigation renders only the active page.
- Doctor/chemist search is debounced and rendered in 60-item batches.
- Global search is debounced and capped at 30 results.
- Record-like cards use CSS containment/content-visibility.

## Runtime checks still required on Android/GitHub
- Gradle dependency resolution and `assembleDebug`.
- Google Places with configured API key.
- Real phone GPS proximity prompt accuracy.
- Double-back behavior with Android gesture/back button.
- Visual/performance smoke test on the target phone.
