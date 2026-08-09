# MR One v1.0

Offline-first Android field assistant for a medical representative.

## Core flow
Today → Quick Doctor Details / Smart Monthly Plan → Doctor Call → Chemist/RCPA → Samples/POB → Expense → DCR/Excel report.

## Doctor intelligence
- Searchable quick completion for imported doctors.
- One-time automatic GPS fetch when Quick Doctor Details or Smart Monthly Plan opens.
- Nearby saved hospital/doctor suggestions.
- Per-doctor monthly visit frequency: 1×, 2×, 3× or 4× per month.
- Optional custom minimum gap days.
- Smart monthly planning first checks visit eligibility, then meeting windows, then timing urgency and nearest-chain distance.
- If Doctor 1 and Doctor 3 are close while Doctor 2 is far, the planner prefers 1 → 3 → 2 when timing windows allow it. If Doctor 2's meeting window will close first, timing can move Doctor 2 earlier.

## Data safety
The app keeps the legacy `mr-daily-auto-v3` data schema so JSON backups from the trial app can be restored and migrated. Restore never intentionally deletes doctor IDs, visits, chemists, GPS, timing, samples, expenses, orders or reports.

## Android
- Package: `com.mrone.fieldapp` (installs alongside the trial app)
- minSdk 28 / targetSdk 34 / compileSdk 35
- Java 17
- Version 1.0.0 (100)
