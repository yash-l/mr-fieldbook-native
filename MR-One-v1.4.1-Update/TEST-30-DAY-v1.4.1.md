# MR One v1.4.1 — 30-day scenario validation

Period simulated: 2026-08-10 through 2026-09-08.

Result: **32,661 checks passed, 0 failures**.

## Latest backup coverage

- Doctors: 212
- Doctors with clinic/address text: 183
- Doctors with saved GPS: 36
- Address present but GPS missing: 151
- Neither address nor GPS: 25

## Scenario matrix covered

- Direct timed meeting: active now, later today, expired window, wrong day, missing timing, second timing window.
- Appointment required: pending, doctor-will-call/pending access, confirmed appointment, appointment time passed, fixed-slot override.
- Card drop → later meeting: card pending, card completed, later window active, later window expired.
- Monthly policy: 1×/2×/3×/4× targets, automatic 0/15/9/7-day gaps, month rollover, firstMeetingDone fallback.
- Next-doctor ranking: nearest feasible, nearest but impossible before window closes, farther feasible, confirmed appointment present.
- GPS states: cached GPS offline, address-only online success, API-key missing, internet unavailable, zero results, wrong candidate not confirmed, confirmed candidate cached.
- Proximity logic: within 50m direct call, appointment pending exclusion, card-drop action.
- Real backup sweep: all 212 doctors evaluated at 09:00/11:00/13:00/17:00/19:00 for every simulated day without an exception.

## Online/offline conclusion

Use a hybrid flow:

1. Use Google Places online only to resolve/verify an address to a clinic pin.
2. Show candidates; never overwrite GPS silently.
3. Save the selected latitude/longitude and Place ID locally.
4. Reuse that saved pin for nearest-doctor and route logic without another lookup.
5. If internet/Places is unavailable and no cached GPS exists, keep the address but mark route-distance as unavailable rather than guessing.

## Build note

Static checks passed. Local Android APK compile could not run because the sandbox cannot resolve `services.gradle.org`; GitHub Actions remains the final Android compile/runtime gate.
