# MR One v1.5.0

## Focused field-work redesign
- Restores **Address missing** as a Doctor filter.
- Removes Expenses, Samples and Tour Program entry points from Home and Tools while preserving old backup data.
- Makes Daily Report, Daily Report Profile, Month Opening Balances and Tool groups collapsible.
- Adds System, Light, Dark and pure Black themes.
- Replaces raw vibration with short device-native selection/confirm/reject haptics and adds a haptics toggle.

## Field AI + location verification
- Renames MR Machine presentation to **Field AI / Verified smart patch**.
- Local decision score now includes clinic access, timing, visit gap, current GPS distance and doctor-location verification.
- Doctor location verification query combines doctor name + hospital name + doctor type + address/area.
- Free mode uses an official Google Maps search URL for manual cross-check.
- Optional Places API mode compares Google candidates inside the app.
- Nearby Hospital flow is now GPS → hospital/clinic → doctor → Google cross-check → save verified pin.

## Update channel
- Keeps stable release signing.
- Keeps direct GitHub Release publishing for in-app updates.
- Uses the fixed workflow version parser.
