# MR One v1.0 Validation

## Passed source checks
- `node --check` passed for `app.js` and `seed-data.js`.
- Android manifest and resources XML parse passed.
- Web manifest JSON parse passed.
- GitHub Actions YAML parse passed.
- Android package wiring is consistently `com.mrone.fieldapp`.
- Quick Doctor Details action/function wiring passed.
- One-time automatic GPS wiring passed for Quick Doctor Details and Smart Monthly Plan.
- Google Places nearby hospital auto-search wiring passed for Quick Doctor Details when an API key is configured.
- Monthly visit policy and monthly eligibility functions are present and wired into planning/intelligence.
- Smart monthly route function is present and timing-aware.
- Uploaded v14.5 backup shape validated: 213 doctors, 228 chemists/stockists, 15 visits. Legacy doctors receive a safe default monthly target of 2 until changed.
- Nearest-chain deterministic test passed: with equal timing windows and Doctor 1 near Doctor 3 while Doctor 2 is far, route order is 1 → 3 → 2.

## Android compile status
A local Gradle compile was attempted but the sandbox cannot resolve `services.gradle.org`, so Gradle 8.13 could not download. This is an environment/network limitation, not a successful APK compile. GitHub Actions must be used for the final Android compiler verification.
