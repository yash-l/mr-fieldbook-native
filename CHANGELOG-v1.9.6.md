# v1.9.6

## Bugfix — doctor meeting time not saving
- In the "Log meeting" form, the "Meeting timing is not confirmed yet" checkbox
  (checked by default for any doctor without saved timing) force-disabled the
  From/To time inputs, so a typed meeting time could never actually be entered
  or saved — the visit itself saved, but the doctor's timing silently didn't.
- Time/day fields now stay editable regardless of that checkbox; only a true
  "Appointment required" clinic system disables them.
- Entering a day or time now auto-clears the "not confirmed" checkbox.
- Submit-time safety net: any day/time the user actually entered is saved
  even if the checkbox state is stale — timing is never silently discarded.
