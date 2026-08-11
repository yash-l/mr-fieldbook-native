# MR One v1.5.3 Validation

## Requested route behavior
- PASS: selected doctor with saved GPS is routable.
- PASS: selected doctor with saved clinic address but no GPS is routable.
- PASS: doctor with neither GPS nor address is not silently routed.
- PASS: Google verification query prioritizes doctor name + hospital/clinic + full address.
- PASS: doctor list search includes doctor name + hospital + address + area + linked chemist + doctor type.
- PASS: mixed coordinate and address stops are emitted to Google Maps Directions URLs.
- PASS: mixed GPS/address selections preserve user selection order instead of guessing a route without coordinates.
- PASS: all-GPS selections retain local nearest-chain optimization.
- PASS: route stop includes Google check and Verify controls.
- PASS: verified GPS is preferred as a coordinate route operand; address-only uses Google-resolved text query.
- PASS: manual multi-filter doctor selection remains intact.

## Static checks
- JavaScript syntax: PASS (node --check).
- versionCode 153 / versionName 1.5.3: PASS.
- ZIP integrity: performed after packaging.

## Final gate
Android signed APK compilation remains the GitHub Actions build gate.
