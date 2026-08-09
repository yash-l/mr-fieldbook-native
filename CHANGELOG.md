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
