# MR One v1.5.2 — Selected Doctor Route

- Restores route planning as a manual doctor-selection workflow.
- Apply any doctor filters/search, then manually select exactly the doctors to include.
- Selected doctors persist while changing filters/search during the session.
- Build route fetches current GPS, orders only selected GPS-ready doctors to reduce backtracking, and previews the stop order.
- Opens the selected route in Google Maps using standard Maps URLs; long selections are split into safe route legs.
- Doctors missing GPS are never silently dropped: they are listed separately with a Fix GPS action.
- Home/Tools route entry now opens Doctor selection instead of the old automatic saved-location planner.
- Expenses, Samples and Tour Program remain removed from Home/Tools.
