# MR One v1.5.5 — Google Maps multi-stop selected route

- Selected doctors now open in Google Maps as one editable multi-stop route (A → B → C …) when the selection fits Google Maps' supported limit.
- Preserves the exact manual doctor order; Google Maps provides its own drag handles for reordering.
- Uses confirmed Google Place ID when available, otherwise saved GPS/address composite location.
- Address-missing doctors remain selected and are sent through Find address / Google check before route launch.
- Does not silently split or drop selections above Google Maps' 9-stop Android limit; the app keeps the full selection and explains the platform limit.
- Removed the v1.5.4 Navigate-next route behavior from the selected-doctor route sheet.
