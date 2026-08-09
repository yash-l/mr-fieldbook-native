# Changelog v20.0.0 — Practical MR Workflow

Base: known-good `8814f9d38b6a3c9c170da30737196d88bd4b37d2` source snapshot.

## Added
- Practical Home quick actions: Doctor Call, Chemist Visit, RCPA, Samples, Expenses and Tour Plan.
- Expense ledger with daily/monthly totals, configurable approved travel rate and route-km suggestion.
- Sample inventory, receive ledger, doctor-wise distribution, batch/expiry and balance protection.
- Sample distribution directly inside doctor DCR.
- Chemist-only visit workflow.
- RCPA / competitor activity capture.
- Daily Tour Program with HQ/EX/OS/Transit and joint work.
- Monthly Target / Primary / Secondary / Collection tracker.
- New XLSX sheets for Expenses, Sample Stock, Sample Distribution, RCPA, Tour Program and Target & Sales.
- Samples, expense and RCPA counts appended to the copy/share daily report.
- Last-good local-state recovery.
- v14.x backup migration for new v20 data model.

## Preserved
- Home / Doctors / Chemists / Activity / Tools bottom navigation.
- Doctor meeting workflow and product feedback.
- SAN overlay / copied SAN workflow.
- GPS verification, nearby hospitals and saved route planning.
- Voice capture.
- Distributor/POB, schemes and company report pack.
- Excel/CSV/JSON import/export.

## Removed from visible native workflow
- Redundant “Install app” card. The native APK is already installed; this card was not useful in normal MR field work.

## Data safety
- No user backup or personal doctor/GPS data is bundled into the source ZIP.
- User backup is restored through Tools → Restore backup.
