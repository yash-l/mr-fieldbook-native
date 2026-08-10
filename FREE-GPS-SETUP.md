# Free GPS / Nearby setup — MR One v1.4.3

No API key or billing is required for the default free path.

## Address → GPS
Use **Find GPS FREE** on a doctor with an address. This uses OpenStreetMap Nominatim only when the user taps search. Results are cached locally.

## Nearby hospitals
Open **Nearby hospitals**, fetch current GPS, choose a radius, then tap **Search nearby FREE**. This uses OpenStreetMap Overpass to find mapped `hospital`, `clinic`, and `doctor` facilities around the current GPS. Search is manual, not continuous, and results are cached for 24 hours.

Saved doctor/hospital pins continue to work offline. Google Places is optional if a `PLACES_API_KEY` is configured.

OpenStreetMap data © OpenStreetMap contributors. Public services are best-effort; do not use them for bulk or automated crawling.
