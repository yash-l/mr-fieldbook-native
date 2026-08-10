# MR One v1.3.1

- Fix Today location-wise planning showing doctors already marked MET in first-week backup data.
- Monthly visit eligibility now also respects `firstMeetingDone` + `firstMeetingDate` when no matching visit row exists.
- Today route start list now applies monthly target/gap eligibility.
- Confirmed appointments still override monthly eligibility and remain routable at their fixed slot.
