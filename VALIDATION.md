# MR One v1.4 validation

## Release identity
- Version code: 140
- Version name: 1.4.0
- GitHub Actions artifact: `MR-One-v1.4-APK`
- Android application id remains `com.mrone.fieldapp` for in-place update compatibility.

## Static checks — PASS
- `node --check` passes for `app.js`.
- Android manifest / values XML parse successfully.
- Web manifest JSON parses successfully.
- GitHub Actions YAML parses successfully.
- 96 HTML IDs checked; no duplicate IDs.
- SAN native bridge callback `deliverPendingSanText` remains present.
- No private MR backup JSON is embedded in the source tree.

## v1.4 workflow checks — PASS
- Doctors screen exposes **Today’s Available** as a top chip and in the filter sheet. It excludes already-met-today doctors, monthly target/gap blocked doctors, appointment-required doctors without a confirmed slot, expired/no-fit windows, and includes card-later doctors only as today card-access tasks while a usable later meeting window remains.
- Three clinic systems are wired: Direct timed meeting, Appointment required, Card drop → later meeting.
- Card-drop completion is stored per doctor/date in backup-safe `clinicActions`.
- Appointment-only doctors require a confirmed fixed appointment before normal route inclusion.
- Card-later doctors require the card step before their later meeting window becomes routable.
- Best Next Call requires monthly eligibility (unless fixed appointment), valid clinic access, GPS, travel ETA and enough remaining window for the call.
- 50 m proximity prompt only offers Start doctor call during a feasible active window; card-later clinics show Card given instead when needed.
- Quick Meeting, Quick Doctor Details and Edit Doctor can store clinic system; card-later requires card drop time.
- XLSX export includes doctor clinic-system fields plus a Clinic Access sheet.
- Existing first-meeting fallback remains in monthly eligibility, so MET doctors without a duplicate visit row are still counted.

## Real backup regression benchmark — PASS
Tested parser/structure against `MR-Daily-Auto-Backup-2026-08-10-First-Week-Met.json` without embedding it in the app:
- 213 doctors
- 228 chemists
- 52 visits
- 0 existing appointment rows
- 53 doctors carrying first-week MET flags
- 7 legacy notes containing `Appointment` are conservatively classified as Appointment required on migration, but are NOT auto-confirmed.
- 2 card-only legacy notes are classified as Card drop → later meeting; explicit AM/PM card time is parsed when present.
- Today’s Available regression at 2026-08-10 11:29 IST: 11 actionable doctors; 0 first-week MET doctors leaked through the monthly gap; 0 legacy Appointment-note doctors leaked without confirmation.

## Android compile status
A local `:app:assembleDebug` attempt could not start because this sandbox cannot resolve `services.gradle.org` to download Gradle 8.13. This is an environment/network limitation, not a reported Java/Gradle compiler result. Final APK compilation must be verified by the included GitHub Actions workflow.

## v1.4.1 address-to-GPS regression
See `VALIDATION-v1.4.1.md` and `TEST-30-DAY-v1.4.1.md` for the 30-day hybrid online/offline GPS validation.


## v1.4.2 free GPS regression
See `VALIDATION-v1.4.2.md`. The doctor address resolver now defaults to manual OpenStreetMap Nominatim with local caching and rate limiting; Google Places remains optional.
