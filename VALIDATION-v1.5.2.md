# MR One v1.5.2 validation

## Selected doctor route
- PASS: Route button exists on Doctors page beside Filter.
- PASS: route selection is manual and independent from filter selection.
- PASS: selected doctor IDs persist while doctor filters/search rerender.
- PASS: Select shown, Clear and Build route controls are wired.
- PASS: Build route starts from current GPS and uses only selected doctors with saved GPS.
- PASS: missing-GPS selected doctors are shown separately and are not silently discarded.
- PASS: route order uses nearest-chain + small 2-opt backtracking reduction.
- PASS: Google Maps URL uses api=1, origin, destination, waypoints and driving mode.
- PASS: selections over 10 doctors are split into route legs.
- PASS: Home/Tools route entry starts doctor route selection; old Tour Program is not restored.

## Compatibility
- PASS: versionCode 152 / versionName 1.5.2.
- PASS: existing multi-filter logic retained.
- PASS: JavaScript syntax validated with node --check.
- PASS: existing signing/update workflow retained.

## Final gate
Android signed APK compilation is performed by GitHub Actions after push.
