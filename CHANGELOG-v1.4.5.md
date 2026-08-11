# MR One v1.4.5

- Completed the requested doctor-filter cleanup.
- No address-availability filter is present. Doctors without an address remain visible and usable.
- Removed leftover “Address unavailable” / “No address” placeholders from doctor/nearby quick-result UI.
- Removed unused legacy doctor filter branches (`available`, `unlinked`, `due`).
- Fixed GitHub Actions release version parsing that caused v1.4.4 to fail after a successful signed APK build.
- Preserved Today’s Available, timing, doctor type, area filters, free OSM nearby/GPS, appointments, card-drop flow, routes, reports, and existing data.
