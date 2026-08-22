# v21 — CORE/NON-CORE, Advance Planning, Doctor/Pharmacy Records, Super Admin, Data Safety

All changes are additive to `app/src/main/assets/web/{app.js,styles.css,index.html}`.
No existing doctor, chemist, visit, or settings data is touched, renamed, or removed.
A full pre-edit copy of the app is kept outside this repo before any change was made.

## Data model (additive only — old saves load unchanged)
- New state arrays: `doctorNotes`, `doctorPrescriptions`, `pharmacyProducts`, `thirtyDayPlan`,
  `backupHistory`, `filtersConfig`, `featureFlags`, `admin`.
- `migrateState()` merges these in with safe defaults for every existing save, so upgrading
  the app does not require any manual migration step and cannot corrupt existing records.

## CORE / NON-CORE doctor separation
- Uses the existing `doctor.coreCategory` field (already present in the data model).
- New filter chips on the Doctors list: **CORE / NON-CORE / Unclassified**, plus the same
  chips inside the full filter sheet.
- CORE/NON-CORE badge shown directly on each doctor card.
- Super Admin can add further custom quick-filter chips (field + match rule) without a
  code change.

## Structured Doctor Records (new "Records" button on every doctor)
- **Notes** — general notes, stored in `doctorNotes`, never mixed into visit/meeting notes.
- **Prescriptions** — dated, multi-product entries in `doctorPrescriptions`, kept fully
  separate from visit notes.
- **Top products** — automatically ranked most-prescribed products, computed live from the
  Prescriptions records (no manual bookkeeping required).

## Pharmacy-wise product availability (new "Products" button on every chemist)
- New `pharmacyProducts` records: product, qty on shelf, available/unavailable, last-checked
  date, optional note — stored per chemist and never mixed into chemist visit notes.

## Planning engine — Date-wise Auto Patch / Automatic Daily Planning / 30-Day Advance Plan
- New scheduling engine (`generateDateWisePlan`) that uses each doctor's meeting days,
  monthly visit target, minimum visit gap, and CORE priority — driven by real visit
  history (`effectiveSuccessfulDoctorVisits`), not guesswork.
- **Today** — automatic daily plan, one tap to push into the existing Smart Patch system.
- **Any date** — date-wise auto patch, pick any date and generate/patch it on demand.
- **Next 30 days** — full advance plan, regenerable at any time ("Recalculate" button).
  Regenerating only touches the planning arrays; it never edits doctor records.
- Reachable from Tools → **Advance Planning**.

## Super Admin section (new 6th bottom-nav tab)
- Real PIN gate, independent of the existing app-unlock PIN, checked with SHA-256 (or the
  native Android bridge hash) — every privileged action (`toggleFeature`, `addFilter`,
  `removeFilter`, `restoreBackup`) re-checks the unlock state itself, not just the button
  visibility, per the "don't rely on hidden UI" requirement. Session unlock only; the app
  re-locks Super Admin on restart.
- **Feature control** — add/remove visibility of 13 app features instantly
  (RCPA, Sales, Distributors, Schemes, Nearby, Route, Orders, SAN overlay, App update,
  Doctor Records, Pharmacy Products, Advance Planning, Voice capture).
- **Doctor filters manager** — add/remove custom quick-filter chips for the Doctors list.
- **Data safety & backup** — see below.
- Honest limitation stated in-app: this is a local offline app, so the PIN gates the
  in-app controls; it is not a server-enforced permission boundary.

## Data safety (fixes "data fades / mixes / corrupts on swap")
- Checksummed rolling snapshots (`snapshotBackup`), kept as the last 8, each verifiable
  on demand (`verifyBackup`).
- Automatic daily snapshot, taken once per day on save.
- Automatic pre-risk snapshot before: JSON import/restore, a real schema-version migration,
  and app reset — so a corrupted or mismatched swap can always be rolled back from
  Super Admin → Data safety → Restore.
- Restore itself snapshots the current state first, so a restore can never destroy data
  irrecoverably.

## Premium UI/UX pass
- New CORE (solid teal) vs NON-CORE (dashed) chip and badge treatment.
- Gradient header/accent styling for the Super Admin page and its first status card,
  including dark/OLED variants.
- Consistent use of the existing structured record/detail/section components for every
  new screen, so Records, Products, Planning, and Admin all feel native to the app
  rather than bolted on.
- Subtle press/hover micro-interactions on cards, chips and buttons (skipped entirely
  under `prefers-reduced-motion`).
- Bottom nav grid updated from 5 to 6 to fit the new Admin tab.

## Non-negotiables honored
- No destructive migrations — every new field is additive with safe defaults.
- No fake/placeholder buttons — every new action is wired to a real function.
- No existing feature removed.
- Existing MR-One doctor/chemist/visit data and current functionality fully preserved.
