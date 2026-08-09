# MR FieldFlow v19

Offline Android field-work app for medical representatives. v19 keeps the v18 self-learning doctor intelligence, GPS verification, POB, route planning, imports and company reports, but redesigns daily work around one simple flow.

## Daily MR flow

1. Open **Today**.
2. Tap **Doctor visit** for the normal call flow.
3. Search the doctor. Saved hospital, chemist and timing are reused automatically.
4. Record the meeting result. If the doctor is not met, the intelligence engine proposes the next saved slot and a same-day replacement.
5. Update only product feedback that changed. POB and extra report metrics stay optional.
6. Use **Chemist visit** for retailer/chemist availability and follow-up without forcing a doctor call.
7. Use **POB order** for chemist → distributor → product ordering.
8. Use **Nearby** or **Route** only when location planning is needed.
9. Log **Field expense** for travel, food, stay, toll/parking or other claim items.
10. Use **Close day** to review calls, doctor logs, chemist visits, POB, expenses and due follow-ups, then copy/share the daily report.

## v19 usability changes

- New **Today** control centre with one primary Doctor Visit action.
- Central bottom-nav **Visit** button.
- Doctor master details are collapsed during a call; open them only when hospital, chemist or timing changed.
- GPS verification is collapsed and never starts automatically.
- Chemist-only visit flow added.
- Expense log and day-close summary added.
- POB, nearby hospitals, route, voice capture and doctor master remain one tap away.
- Reports and setup are lower-priority disclosures instead of dominating the home screen.

## Stability / data-safety changes

- Existing v18 local data uses the same storage key and is migrated to v19.
- Every successful save records `lastSavedAt`.
- Before replacing the main local state, the previous valid JSON is retained as a last-good recovery copy.
- If the primary state becomes unreadable, the app attempts last-good recovery.
- Doctor visit and POB forms now guard against double-submit duplicate records.
- Android Back closes an open sheet first, then returns to Today, then exits.
- Voice and active GPS listeners are stopped on pause/destroy.
- WebView is destroyed cleanly when the activity closes.
- Cleartext traffic is disabled.
- Fresh installs no longer contain fake daily call/opening figures.
- Fresh installs do not start GPS on app launch.

## Intelligence preserved

- Timing-aware smart patch / next-best-call queue
- Follow-up and overdue priority
- Not-met history
- Self-learning doctor meeting pattern from local visit outcomes
- Automatic next-meeting calculation
- Same-day replacement doctor suggestion
- Product opportunity / lost-prescriber signals
- Doctor data-completion quality checks
- Duplicate-doctor detection
- 2 successful visits/month maximum and 15-day minimum successful-call gap
- Patch, reschedule and intelligence audit history

The intelligence is local adaptive scoring, not an LLM or cloud AI.

## GPS behaviour

GPS is not attendance tracking and is not continuous. v19 fetches GPS only after an explicit location action such as hospital verification, Nearby or route planning. Saved coordinates can be used later for routing.

## Full XLSX sheets

- Summary
- Doctors
- Chemists
- Distributors
- Orders
- Expenses
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

## Company report pack

Tools → **Generate 4 company files** creates:

1. `Lost Prescrber rapid action & Follow up.xlsx`
2. `MY Z & NICU Covering July.26.xlsx`
3. `Kunjan compilation july26.xlsx`
4. `GUJ_SALES.xlsx`

Official primary/secondary/closing sales are never fabricated; missing official values stay blank and are listed in Data Missing.

## Android build

- `versionCode 190`
- `versionName 19.0.0`
- Java 17
- minSdk 28
- targetSdk 34
- compileSdk 35

GitHub Actions artifact: `MR-FieldFlow-v19-APK`.
