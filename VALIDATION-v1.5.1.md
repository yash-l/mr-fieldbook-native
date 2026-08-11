# MR One v1.5.1 Validation

## Multiple doctor filters
- PASS: legacy single scalar `doctorFilter` removed.
- PASS: Today’s Available can combine with timing, address, type and area filters.
- PASS: Timing added / Timing missing are mutually exclusive.
- PASS: multiple Doctor Types use OR semantics inside the type group.
- PASS: multiple Areas use OR semantics inside the area group.
- PASS: different groups use AND semantics.
- PASS: quick chips toggle without replacing other active filters.
- PASS: filter sheet supports toggle, Apply and Reset all.
- PASS: active filter count appears on Filter button and subtitle.
- PASS: Address Missing filter remains available.
- PASS: no-match state explains that the combination can be relaxed/reset.

## Compatibility
- PASS: app.js parses with `node --check`.
- PASS: synthetic multi-filter semantic test returns expected doctors.
- PASS: latest supplied backup parses: 212 doctors, 29 Address Missing.
- PASS: versionCode 151 / versionName 1.5.1.
- PASS: GitHub workflow still uses stable release signing and dynamic versioned artifact/release naming.

## Final gate
Android signed APK compilation is performed by GitHub Actions; it was not executed in this container.
