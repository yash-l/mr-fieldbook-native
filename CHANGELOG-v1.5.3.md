# MR One v1.5.3 — Address + GPS route verification

- Selected doctor route now accepts either saved GPS or a saved clinic address.
- Doctor search already covers doctor name, hospital/clinic, address, area and type; this behavior is retained for route selection.
- Route Google cross-check query is explicitly Doctor name + Hospital/Clinic + full Address.
- Verified GPS stops use coordinates in Google Maps.
- Address-only stops use the composite Google Maps place/address query and are no longer excluded.
- Mixed GPS + address doctor selections can be opened in one or more Google Maps route legs.
- Each route stop exposes Google check + Verify before launching the full route.
- Doctors with neither GPS nor address remain visible but are flagged as not routable.
- Multiple filters, manual doctor route selection, Field AI, free OSM GPS, optional Google Places, themes, reports and data compatibility are preserved.
