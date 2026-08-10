# MR One v1.4.3 validation

## Passed locally
- `node --check app/src/main/assets/web/app.js` — PASS.
- `versionCode 143` / `versionName 1.4.3` — PASS.
- GitHub artifact name `MR-One-v1.4.3-APK` — PASS.
- Java source brace/parenthesis balance — PASS.
- `javac` parse produced dependency errors only (Android/Google classes unavailable in this container), with no Java syntax diagnostics — PASS for syntax, not an Android compile.
- Free nearby bridge exists from WebView JS → Android → Overpass callback.
- No Google key required for the **Search nearby FREE** path.
- Existing Google nearby search kept as optional secondary path.
- Existing Nominatim doctor-address lookup retained.
- OSM IDs and Google Place IDs stay separate.
- Hospital/doctor record is changed only after explicit hospital + doctor selection.
- Nearby radius is clamped to 5 km.
- Overpass result cache TTL is 24 hours.

## Environment limitation
The container has no outbound DNS for direct Overpass execution, so a real Overpass response and Android APK compile were not claimed here. The request structure follows current Overpass API documented `nwr`, tag-regex, absolute-coordinate `around`, and `out center` syntax. GitHub Actions is the final Android compile gate.
