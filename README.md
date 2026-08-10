## v1.4.3 Free nearby hospitals

Nearby hospital/clinic/doctor-office discovery now defaults to OpenStreetMap Overpass and does not require a Google API key. Searches are user-triggered and cached for 24 hours. Google Places is optional.

# MR One v1.4.0

Offline-first Android field companion for a medical representative. v1.4 adds real clinic-access intelligence on top of the v1.3 performance/premium workflow: Direct timed meeting, Appointment required, and Card drop → later meeting, then ranks only feasible next calls by eligibility, time window, GPS distance and travel ETA. Doctors also get a **Today’s Available** filter that applies the same clinic-access and remaining-window rules before showing a doctor.

## v1.3 fast field flow

- **Doctor will call** → choose reminder date/time → reminder stays at the top of Home → when the doctor calls, tap **Doctor called → Add time** → enter exact appointment time → Smart Plan treats it as a fixed slot.
- **Appointments** remain separate from pending call-backs, so the route is not blocked until a real time is confirmed.
- **Doctor filters:** Today’s Available, Timing added, Without timing, Pedia, Gynaec, GP, Matron and inferred locality.
- **Ahmedabad locality:** saved address/hospital text is used to infer areas such as Nikol, Naroda, Bapunagar, Odhav, Krishnanagar, Thakkarnagar, Hirawadi and Asarva. If there is not enough evidence, the app shows **Area pending**.
- **Google:** one-tap doctor-name search and address search.
- **Product fit:** Gynaec/GP prioritize Zefrich + Zefrich HP; Pedia/Matron prioritize MumMum 1 + MumMum 2 + Simyl MCT, while saved doctor focus brands remain visible.
- **50 m proximity:** when a foreground GPS fetch places you within 50 m of a saved doctor location, the app offers to start that doctor call. No continuous background tracking is added.
- **Performance:** active-page-only rendering, debounced searches, 60-record render batches, result caps and off-screen rendering containment.
- **Exit:** from Home/dashboard, press Back twice within 1.8 seconds to exit.

## v1.2 appointments

- Home + Tools → Appointments.
- Type-to-find doctor/hospital selection.
- Confirmed appointment requires exact time and can override normal meeting timing/monthly completion for that explicit appointment.
- Smart route reserves the saved appointment duration.
- Successful doctor meeting auto-completes same-day appointment records.
- Appointments export in a separate XLSX sheet and are included in JSON backup/restore.

## Previous v1.1 notes
Smart offline-first field app for a medical representative. v1.1 improves Smart Monthly Doctor Plan routing without changing existing backup/data schema.

## v1.1 routing

- Monthly visit eligibility first.
- Doctor meeting window is a hard constraint.
- 12-minute doctor-call duration is reserved before the route accepts a stop.
- Nearby-cluster look-ahead + backtracking penalty reduce avoidable zig-zag movement.
- 2+ hour idle gaps split the route into separate main/later legs.
- Google Maps receives the planned stop order and calculates exact road navigation.
- Excluded doctors show the exact reason instead of one generic warning.

Android MR field app using the existing mobile UI, with a local intelligence layer for daily patch preparation, doctor follow-up, not-met rescheduling, hospital verification, POB and company reports.
> Built from the known-good 8814f9d working snapshot. Existing Home / Doctors / Chemists / Activity / Tools navigation, SAN copy overlay, GPS/nearby/route, voice capture, imports, POB, schemes and reports are preserved. v20 adds practical MR work without replacing the working foundation.

## Practical v20 additions

- **Expense ledger** — TA/DA, travel, stay, toll/parking, public transport and other field claims. Optional approved ₹/km rate; saved route distance is only a suggestion.
- **Sample stock & distribution** — opening/received stock, batch/expiry, balance, doctor-wise issue, and automatic balance check during doctor calls.
- **Tour Program (TP)** — date, HQ/EX/OS/Transit, area, joint work, objective; same-date DCRs link to the saved plan.
- **Chemist-only visits** — availability, POB follow-up, stock/distributor follow-up and general market notes without forcing a doctor selection.
- **RCPA / competitor capture** — chemist, related doctor, own brand availability, competitor brand/company and observed Rx/units.
- **Target & Sales** — monthly target, primary, secondary and collection self-tracking without fabricating product-wise sales.
- **Backup migration** — v14.x JSON backups restore into v20 while keeping doctor IDs, GPS, timings, chemist links, visits, orders, SAN enrichment and unknown metadata.
- **Last-good local recovery** — before each save the previous database is retained as a recovery copy.

### Deliberately not added

Manager approval hierarchy, payroll/HRMS, in-app chat and continuous live employee tracking are not part of this offline single-MR build. They add complexity without helping day-to-day personal field execution.


## Main workflow

1. Import or add doctors, hospitals/clinics, linked chemists and products.
2. Save doctor meeting days and up to two timing windows. Quick presets: **Mon–Sat**, **Every day**, **Morning 10–12**, **Evening 5–8**, and **Both**.
3. Open **MR Machine**. It reads saved timing, follow-up dates, visit history, not-met history, product feedback and data completeness.
4. Review and confirm the suggested daily patch.
5. Open a doctor call and select the result:
   - Doctor met
   - Doctor not met
   - Doctor on leave
   - Doctor in OT
   - Hospital closed
   - Timing changed
6. When the doctor is not met, the app calculates the next available saved meeting slot and suggests a replacement doctor for the current day.
7. Save product feedback, chemist availability, POB/distributor order and notes.
8. Generate the daily report, full XLSX, or the four-file company report ZIP.

## Intelligence included

- Timing-aware daily smart patch
- Follow-up and overdue priority
- Not-met history priority
- Automatic next-meeting calculation
- Same-day replacement doctor suggestion
- Product opportunity signal: feedback pending, regular, declining or lost prescriber
- Doctor master completion score
- Missing hospital, chemist, timing and GPS verification counters
- Possible duplicate doctor detection
- Confirmed patch history for reporting
- Reschedule history and machine action audit

The score is explainable. Each suggested call shows its reasons. It does not submit or change company systems automatically.

## GPS behaviour

GPS is not used for attendance, continuous tracking or smart-patch scoring.

- Meeting form does not start GPS automatically.
- GPS runs only after **Verify hospital GPS** is tapped.
- Captured coordinates can be saved as the doctor/hospital verified location.
- Nearby hospital discovery uses GPS only to find and fill hospital data.
- Route planning uses only previously verified doctor/hospital coordinates and a saved doctor/hospital as the starting point; it does not fetch current GPS.

## Company report pack

Tools → **Generate 4 company files** creates one ZIP containing four separate XLSX files:

1. `Lost Prescrber rapid action & Follow up.xlsx`
2. `MY Z & NICU Covering July.26.xlsx`
3. `Kunjan compilation july26.xlsx`
4. `GUJ_SALES.xlsx`

The reports use actual app data. Official target, primary, secondary and closing-sales values are left blank until official sales data is imported; the app does not invent figures. Each workbook includes a **Data Missing** sheet.

## Full XLSX sheets

- Summary
- Doctors
- Chemists
- Distributors
- Orders
- Visits
- Location Audit
- Schemes
- Today Route
- Smart Patch
- Reschedules
- Data Quality
- Distributor Planning
- Products
- Voice Captures

## Android build

The APK builds on GitHub Actions. **No Google API key is required for the default GPS workflow.** MR One v1.4.3 uses OpenStreetMap Nominatim for manual doctor address → GPS lookup and OpenStreetMap Overpass for manual nearby hospital/clinic/doctor-office discovery. Lookup results are cached locally and confirmed pins are reused offline. Google Places remains optional.

Build artifact:

`MR-One-v1.4.3-APK`



## v1.4.2 Free address → GPS

- **Find GPS FREE** uses OpenStreetMap Nominatim; no API key or billing account is required.
- Lookup is manual/on-demand only — no autocomplete, background scraping, or bulk querying.
- A single-thread native queue enforces at least 1.1 seconds between public Nominatim requests.
- Successful query results are cached locally; repeating the same address returns the cache instead of hitting the public service again.
- Nothing overwrites a doctor's GPS until the user checks a result and taps **Use this GPS**.
- Confirmed latitude/longitude is stored with the doctor and reused by nearest-doctor, 50 m detection, and route planning offline.
- Google Places remains optional as a fallback when a key is configured.
- Nearby hospital discovery uses Overpass instead of Nominatim. It runs only when the user taps **Search nearby FREE**, with a 5 km maximum radius and a 24-hour local cache.
- OpenStreetMap attribution is shown in the free lookup sheet.

## v14.3 Planning correction
- Accepted POB orders automatically create a pending distributor stop.
- Distributor stop remains visible until the order is marked fulfilled.
- Doctors sharing the same hospital/map pin are grouped into one location stop.
- Distributor location uses a manually verified Maps pin; device GPS remains doctor/hospital-only.
- Google Maps calculates the actual road route; in-app kilometre values are approximate straight-line estimates.


## v14.4 SAN copy overlay + premium field flow

- Tools → **SAN copy overlay** requests the Android “Display over other apps” permission once.
- A draggable **MR** bubble stays visible over SAN while the user chooses what to copy.
- The bubble expands into a paste/review box. It reads the clipboard only after the user taps **Paste clipboard**.
- **Send to MR** opens a review screen where doctor, hospital, chemist, distributor, timings, products and POB are detected before anything is saved.
- **Use these details in Log Meeting** pre-fills the normal meeting screen; final save remains user-confirmed.
- The meeting chemist field is now searchable by chemist name, area and address instead of a long dropdown.
- Route ordering uses strict nearest-chain logic: selected start → nearest stop → nearest from that stop. Timing conflicts are warnings and no longer reorder a nearer stop.
- Premium sheet/page transitions and native haptic feedback are included.

Protected apps may choose to block overlays. In that case, copy in SAN, return to MR, and use **Paste current clipboard directly in app**.

## v1.4 clinic access intelligence
See `CHANGELOG-v1.4.md`.
