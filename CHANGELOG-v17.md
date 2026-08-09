# MR Machine Intelligence v17.0

- Removed SAN floating overlay UI, service, overlay permission and foreground service permission. Direct in-app clipboard paste remains.
- Offline planning uses phone GPS + saved doctor/hospital GPS; no Maps/Places API is required for doctor selection.
- Doctor eligibility: max 2 successful visits/month and minimum 15 days between successful visits. Not-met attempts do not consume this quota.
- Not Met automatically keeps the doctor in reschedule flow and proposes the nearest eligible available replacement using the last saved field GPS anchor.
- Route planner excludes locked/completed doctors and prioritizes nearest eligible stops, with an urgency override when a meeting window is closing.
- Self-learning uses actual visit history (weekday/hour success rate, not-met history and meet rate) to adjust recommendation scores with low/medium/high confidence.
- Successful meetings write nextEligibleDate and the 15-day/2-per-month policy into the doctor record.
- Dead automatic bundled-SheetJS startup import path is no longer executed. Embedded seed / native spreadsheet import remains the supported offline path.
