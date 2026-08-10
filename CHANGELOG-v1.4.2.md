# MR One v1.4.2 — Free GPS patch

- Default doctor address resolver: OpenStreetMap Nominatim.
- No API key and no billing account required for this manual resolver.
- Manual button only; no autocomplete or bulk geocoding.
- Native single-thread queue with 1100 ms minimum spacing.
- Successful query results cached in Android SharedPreferences.
- Candidate confirmation required before latitude/longitude is saved.
- OSM source metadata stored as `osmId`, `locationSource`, and `gpsResolutionMode`.
- Confirmed pin continues to work offline in nearest, route and 50 m logic.
- Optional Google Places fallback preserved.
