# v1.9.8

## Route build — stop cards now match the Doctors list card style
Each stop in the "Selected doctor route" sheet is now the exact same card
component used on the Doctors list (`.record-card`): a round avatar badge,
name + hospital header, a tag row for status, and a 4-button action grid —
instead of the separate colored-bar layout from v1.9.7.

- Avatar shows the stop letter (A, B, C…) instead of initials, since order is
  the most useful thing to see at a glance here.
- Tag row shows the same green/amber "good/due" chip language as the doctor
  cards (Verified GPS = green, Saved GPS/Address only = amber, Find address =
  red) — plus a "Stop A" chip next to the name.
- Action row is Up / Down / Move / Check (or Find), laid out in the same
  4-column grid as Verify/Map/Call/View on doctor cards, with Check/Find
  styled as the primary action.
- No behavior changed — same reorder logic, same Google Maps hookup, same
  9-stop limit and address-missing guidance as v1.9.7.
