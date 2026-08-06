# MR Machine Intelligence v14

Android MR field app using the existing mobile UI, with a local intelligence layer for daily patch preparation, doctor follow-up, not-met rescheduling, hospital verification, POB and company reports.

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
- Products
- Voice Captures

## Android build

The APK builds on GitHub Actions. Optional live Google nearby-hospital results require a repository secret named `PLACES_API_KEY`. Without the key, the app and saved-hospital workflow still work.

Build artifact:

`MR-Machine-Intelligence-v14-APK`
