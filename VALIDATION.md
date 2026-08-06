# Validation — MR Machine Intelligence v14

## Passed in this delivery

- `app.js` passes `node --check`.
- Browser runtime smoke test loaded the embedded 39-doctor seed and rendered the intelligence dashboard without JavaScript exceptions.
- MR Machine sheet rendered 12 ranked doctor suggestions and the data-quality dashboard.
- Quick meeting screen rendered six meeting outcomes, timing presets and manual-only hospital GPS verification.
- A simulated **Doctor on leave** save created one call, one pending reschedule and a replacement-doctor suggestion without requesting GPS.
- Existing v13 doctor, chemist, visit, nearby hospital, order, backup and XLSX data structures are migrated to v14.
- Not-met records store outcome, reason, suggested date/time, replacement doctor and machine action.
- Smart Patch, Reschedules and Data Quality sheets are added to the full XLSX.
- Four company reports are generated as separate XLSX files inside one ZIP using the native Android bridge.
- App version is 14.0.0 / versionCode 14.
- Android manifest, resource XML and web manifest parse successfully.

## Still requires phone/GitHub verification

- GitHub Actions Android compilation and dependency resolution.
- APK installation on the user's phone.
- Real microphone and hospital GPS verification.
- Live Google Places results when `PLACES_API_KEY` is configured.
- Saving and opening the four-workbook ZIP on Android.
- Final column mapping against the company's latest official report templates and official sales source.

## Accuracy limitation

The generated company files use corresponding report names and mapped business fields, but do not preserve every style, merged cell or formula from the supplied original templates. Official sales values remain blank until imported.
