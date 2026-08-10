# MR One v1.4.2 — Free GPS validation

Period swept: 2026-08-10 through 2026-09-08.

- Backup doctors: 212
- Address/hospital-address present: 183
- Saved GPS present: 36
- Address present but GPS missing: 151
- 30-day doctor/time shape checks: 31,800
- Policy/source assertions: 12
- Failures: 0

## Free resolver assertions
- nominatim_endpoint: PASS
- india_filter: PASS
- single_thread: PASS
- rate_1100: PASS
- cache_shared_preferences: PASS
- user_agent: PASS
- manual_bridge: PASS
- no_autocomplete: PASS
- osm_attribution: PASS
- confirmation_required: PASS
- google_optional: PASS
- offline_reuse: PASS

## Runtime note
The sandbox cannot download Gradle from services.gradle.org, so Android APK compilation is not claimed here. GitHub Actions remains the compile/runtime gate. Network calls to the public Nominatim server were not executed from the sandbox; response parsing/error/cache paths are implemented in source and validated structurally/mocked by the source assertions.
