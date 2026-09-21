# Upgrade notes

## Included in this zip
Fix: doctor meeting time silently failing to save (Log meeting form).

### What was wrong
In the "Log meeting" sheet, the "Meeting timing is not confirmed yet" checkbox
is checked by default for any doctor with no saved timing yet. While checked,
the From/To time inputs were force-disabled, so a user could not actually type
a time into them — and on submit, if that checkbox was still checked for any
reason, the entered meetingDays/meetingFrom/meetingTo/meetingFrom2/meetingTo2
were discarded even though the visit itself was saved.

### What changed (app.js, styles.css)
1. `setTimingDisabled()` no longer disables the time/day fields just because
   the "not confirmed" checkbox is checked — only a true "Appointment required"
   clinic system disables them now. The pending state is now shown as a dashed
   outline (`.day-selector.pending` in styles.css) instead of blocking input.
2. Entering a day or a time now auto-clears the "not confirmed" checkbox.
3. Submit-time safety net: if the user entered any day/time, it is saved
   regardless of the checkbox's state — timing is never silently discarded.

### How to apply
Replace these two files in your project with the versions in this zip, then
rebuild:
- `app/src/main/assets/web/app.js`
- `app/src/main/assets/web/styles.css`

Nothing else in the project was touched — this zip is the full project tree
so it can be dropped in wholesale, but only those two files differ from your
upload.

## Not yet included (still to plan/build)
- General usability pass across the rest of the app (needs you to point at
  specific screens/flows — "usability" is too broad to safely rewrite blind)
- A real background/scheduled daily refresh (push notification style) — see
  CHANGELOG-v1.9.7.md for why the patch itself doesn't need this to stay current

