# MR FieldFlow v19 validation

Validation performed on the packaged source in this environment.

## Passed
- `node --check app/src/main/assets/web/app.js`
- `node --check app/src/main/assets/web/seed-data.js`
- AndroidManifest XML parse
- Web manifest JSON parse
- Static HTML parse and duplicate-ID check
- GitHub Actions workflow YAML parse
- Static render/bind ID audit for Today, Doctors, Chemists, Activity and Tools
- Default-state test: v19, zero fake visits, zero fake opening calls, Expenses array present
- v18 → v19 migration test
- Expense total/save-state test
- Corrupt-primary → last-good-state recovery test
- App versionCode 190 / versionName 19.0.0
- GitHub artifact name updated to `MR-FieldFlow-v19-APK`
- Cleartext traffic disabled
- Startup GPS removed
- Doctor visit and POB duplicate-submit guards present
- Android Back handler added
- Speech/GPS lifecycle cleanup and WebView destruction added

## Android compile status
A full Gradle APK compilation could not be completed in this execution environment because the supplied launcher needs to download Gradle 8.13 from `services.gradle.org`, and DNS/network access is unavailable here. The build attempt was made and failed only at that download step.

Use the included GitHub Actions workflow or an Android SDK environment with network access for the final APK compile.
