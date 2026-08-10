# MR One v1.4.1 validation

- Source base: MR One v1.4 with Today’s Available filter.
- Android version: 1.4.1 / versionCode 141.
- GitHub artifact: MR-One-v1.4.1-APK.
- Address-to-GPS flow is confirm-before-save; no silent coordinate replacement.
- Existing GPS remains valid for offline planning after it has been cached.
- 30-day simulation: 32,661 checks, 0 failures, 2026-08-10 through 2026-09-08.
- Latest backup swept: 212 doctors, 183 address records, 36 saved GPS, 151 address-without-GPS.
- Static validation: JavaScript syntax PASS; XML/JSON/YAML parse PASS; duplicate HTML IDs = 0.
- Local APK compile was not completed because the sandbox cannot resolve services.gradle.org.
- No user backup is bundled in source.
