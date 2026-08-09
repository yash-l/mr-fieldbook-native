# Validation — MR FieldBook Practical v20

## Passed locally
- `app.js` passes `node --check`.
- Android manifest, Android strings XML and web manifest parse correctly.
- HTML parses successfully.
- Android version is `20.0.0` / versionCode `200`.
- GitHub Actions artifact name is `MR-FieldBook-Practical-v20-APK`.
- v14.5 user backup migration smoke test preserved:
  - 213 doctors
  - 228 chemists/stockists
  - 15 activity logs
  - profile / HQ
  - `_mergeInfo`
  - existing orders, GPS, timings, links and source fields through the generic migration object
- New v20 arrays initialize safely when absent: expenses, sampleItems, sampleTransactions, tourPlans, rcpa and salesMonths.
- Personal backup JSON is not bundled inside the source tree.

## Build status
A full Android APK compilation is not claimed here. Use the included GitHub Actions workflow; it builds with Java 17 and uploads `MR-FieldBook-Practical-v20-APK`.
