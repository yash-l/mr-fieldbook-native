# MR One v1.5.4 Validation

- PASS: versionCode 154 / versionName 1.5.4.
- PASS: selected route uses one Set-backed ordered list for all selected doctors.
- PASS: no selectedDoctorRouteLegs route splitting function remains.
- PASS: no selected-route automatic optimizer is used.
- PASS: Up / Down / Move-to-position controls reorder the complete selected route.
- PASS: Next Stop cursor retains the full selected route while navigating one doctor at a time in Google Maps.
- PASS: doctor without address/GPS remains listed as a Find-address task.
- PASS: missing-address search query includes doctor name, hospital/clinic, doctor type, area/HQ and Gujarat/India.
- PASS: doctor with address/GPS retains Google cross-check and Navigate action.
- PASS: JavaScript syntax verified with node --check.
- PASS: full ZIP and update ZIP integrity verified after packaging.

Android signed APK compilation is performed by GitHub Actions after push.
