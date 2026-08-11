# MR One v1.4.5 validation

Validated against the v1.4.4 full-source baseline.

- versionCode 145 / versionName 1.4.5: PASS
- Doctor filter panel contains only All, Today’s Available, Timing added, Without timing, doctor type and Area: PASS
- No address-availability filter: PASS
- Doctors without address are not excluded by renderDoctors(): PASS
- Leftover `Address unavailable` / `No address` placeholders removed from app.js doctor/nearby/quick-result UI: PASS
- Unused legacy doctor filter branches `available`, `unlinked`, `due` removed: PASS
- Today’s Available logic retained: PASS
- Free OpenStreetMap nearby/GPS code retained: PASS
- Google Places remains optional: PASS
- GitHub Actions release version parser replaced with robust grep parser: PASS
- JavaScript syntax (`node --check`): PASS

Android signed release compile must still be verified by GitHub Actions after push.
