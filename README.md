# MR Daily Auto — Exact Webpage Android v9

This project packages the MR Daily Auto v7 webpage UI inside a native Android APK.

## What stays the same

- Same dashboard, colors, cards, navigation and bottom sheets
- Search doctor or hospital instead of a long selection list
- Doctor → hospital → linked chemist structure
- Doctor-wise meeting days and timing windows
- GPS, product-wise prescribed/not prescribed/no feedback, notes and follow-up
- Automatic Today/Cumulative report and WhatsApp-ready sharing
- Doctors, chemists, meetings and settings stored offline on the phone
- Same JSON backup format as the webpage app

## Native Android bridge

The webpage UI uses Android only for:

- Location permission and current GPS
- Excel/CSV file picker and offline `.xlsx` parsing
- Backup/CSV save picker, including Google Drive when available in Android's picker
- Android share sheet and clipboard
- External maps/WhatsApp links

## Build

GitHub Actions builds `app-debug.apk` automatically after every push to `main`.

Artifact name:

`MR-Daily-Auto-Exact-Webpage-v9-APK`

## Move existing webpage data

1. Open the old webpage app.
2. Tools → Full backup.
3. Open this APK.
4. Tools → Restore backup.
5. Select the exported JSON file.

## Excel support

`.xlsx` and `.csv` import work offline. Old binary `.xls` files should be opened in Excel/Google Sheets and saved as `.xlsx`. The supplied old `.xls` data is already included in the embedded starter data.
