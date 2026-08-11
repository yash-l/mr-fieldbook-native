# v1.5.1
- Added true multiple doctor filter application with active count and reset.

# MR One v1.5.0

## Focused field-work redesign
- Restores **Address missing** as a Doctor filter.
- Removes Expenses, Samples and Tour Program entry points from Home and Tools while preserving old backup data.
- Makes Daily Report, Daily Report Profile, Month Opening Balances and Tool groups collapsible.
- Adds System, Light, Dark and pure Black themes.
- Replaces raw vibration with short device-native selection/confirm/reject haptics and adds a haptics toggle.

## Field AI + location verification
- Renames MR Machine presentation to **Field AI / Verified smart patch**.
- Local decision score now includes clinic access, timing, visit gap, current GPS distance and doctor-location verification.
- Doctor location verification query combines doctor name + hospital name + doctor type + address/area.
- Free mode uses an official Google Maps search URL for manual cross-check.
- Optional Places API mode compares Google candidates inside the app.
- Nearby Hospital flow is now GPS → hospital/clinic → doctor → Google cross-check → save verified pin.

## Update channel
- Keeps stable release signing.
- Keeps direct GitHub Release publishing for in-app updates.
- Uses the fixed workflow version parser.

# MR One changelog

## v1.4.4
- Fast in-app update: Tools → App update → Check → Download & Update.
- Stable release signing + automatic GitHub Release publishing.
- Final Android install confirmation remains required.

# MR One v1.4.3

## Free nearby hospitals
- Replaced Google-only **Search live hospitals** as the default path with **Search nearby FREE** using OpenStreetMap Overpass.
- Searches hospital, clinic and doctor-office POIs around the current GPS at 500 m / 1 km / 2 km / 5 km.
- User selects the hospital and then the accurate saved doctor before any doctor GPS/hospital data is changed.
- Overpass results are cached for 24 hours; saved doctor/hospital pins remain usable offline.
- Google Places remains an optional secondary search when `PLACES_API_KEY` is configured.
- Existing v1.4.2 free Nominatim address → GPS lookup is preserved.

# MR One v1.4.2

## Free GPS resolver
- Added **Find GPS FREE** for doctor clinic addresses using OpenStreetMap Nominatim.
- Google Places API key is no longer required for doctor address → GPS resolution.
- Added single-thread 1.1-second request spacing, local query-result cache, India country filter, and visible OpenStreetMap attribution.
- Existing GPS is never replaced until the user confirms a candidate with **Use this GPS**.
- Saved pin is reused offline by nearest/route/proximity logic.
- Optional Google Places fallback remains when configured.
- Public Nominatim is intentionally not used for automated nearby-hospital crawling.

# MR One v1.3.0

## Field workflow
- Added **Doctor will call** workflow: reminder date/time is mandatory, reminder stays at the top of Home, and converts to a confirmed appointment only when the doctor actually calls and the MR enters the exact time.
- Confirmed appointment remains a hard Smart Monthly Plan slot; pending doctor-call reminders do not reserve route time.
- Existing doctor notes containing “appointment” are surfaced as review candidates; they are never auto-confirmed.
- Added **Timing added / Without timing** doctor filters plus Pedia / Gynaec / GP / Matron and locality filters.
- Added one-tap Google search for doctor name and saved address.
- Added doctor-type badges and specialty-aware product suggestions: Gynaec/GP -> Zefrich + Zefrich HP; Pedia/Matron -> MumMum 1 + MumMum 2 + Simyl MCT, with saved focus brands still visible.
- Added evidence-based Ahmedabad locality inference from saved address/hospital text. Unknown locality is shown as **Area pending** instead of inventing a place.
- Added one-time/foreground GPS proximity check: within 50 m of a saved, not-yet-called doctor location, MR One offers **Start doctor call**.

## Performance & UI
- Replaced all-page re-rendering with active-page-only rendering.
- Debounced doctor/chemist/global search and capped visible list batches with Show more.
- Added CSS containment/content-visibility for off-screen record cards.
- Reduced navigation animation work and simplified premium card hierarchy.
- Added double-back exit behavior from the dashboard.

## Preserved
- Existing JSON backup compatibility, doctor/chemist IDs, visits, GPS, monthly visit rules, SAN overlay, voice, Google Places, Excel reports, expenses, samples, RCPA, POB and smart routing.
