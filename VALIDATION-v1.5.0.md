# MR One v1.5.0 Validation

**Result: 29/29 checks passed.**

## Backup fixture
- Doctors: 212
- Address missing: 29
- Existing GPS pins: 36
- 30-day smoke window: 2026-08-10 → 2026-09-08

## Checks
- PASS — Version 1.5.0
- PASS — Home/Tools Expenses removed
- PASS — Home/Tools Samples removed
- PASS — Home/Tools Tour Plan removed
- PASS — Address missing filter UI
- PASS — Daily report collapsible
- PASS — Profile collapsible
- PASS — Opening collapsible
- PASS — Tools grouped/collapsible
- PASS — Dark theme
- PASS — Black theme
- PASS — Theme persisted
- PASS — Haptics optional
- PASS — Native system haptics
- PASS — Legacy raw vibrator removed
- PASS — Google doctor/hospital/type query
- PASS — Free Google Maps URL
- PASS — Optional automatic Google Places
- PASS — Nearby verification gate
- PASS — Field AI GPS binding
- PASS — Auto update workflow parser fixed
- PASS — Workflow YAML parse
- PASS — Stable signed release task
- PASS — Release publish enabled
- PASS — Backup doctor count preserved — 212
- PASS — Address-missing filter expected count — 29
- PASS — Existing GPS count recognized — 36
- PASS — 30-day compatibility smoke — 2026-08-10 through 2026-09-08
- PASS — Java class closes

## Verification boundary
- JavaScript syntax was checked with `node --check`.
- Workflow YAML parsed successfully.
- Android release APK compilation is intentionally left to GitHub Actions because this container does not provide the Android SDK build environment.
- Free Google cross-check uses the official Google Maps URL and requires the user to visually confirm the location. Automatic Google candidate comparison only runs when a valid Places API key exists.
- Expenses, Samples and Tour Program data structures are preserved for old-backup compatibility but their Home/Tools entry points are removed.
