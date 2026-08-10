# MR One v1.4

- Added Doctors → **Today’s Available** filter: shows only doctors still actionable today after monthly eligibility/MET-gap, clinic-system access, today meeting day and remaining usable meeting window are checked.
- Added 3 real clinic access systems: Direct timed meeting, Appointment required, Card drop → later meeting.
- Added card-drop completion tracking per doctor/day.
- Appointment-only doctors stay out of normal route until a confirmed fixed slot exists.
- Added Home “Best next call” intelligence using clinic access, monthly eligibility, current GPS, travel ETA, meeting-window feasibility and closing urgency.
- 50 m proximity prompt now respects clinic access and active meeting window; card-drop clinics show Card given instead of a false doctor-call prompt.
- Smart Monthly Plan now excludes access-blocked doctors and surfaces card-drop tasks separately.
- Clinic system and card-drop time are backup-safe and exported in XLSX.
- Legacy doctor notes containing “Appointment” migrate conservatively to Appointment required (not confirmed); plain card notes migrate to Card drop → later meeting and AM/PM card time is parsed when present.
