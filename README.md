# MR FieldBook Native v8

Native Android field-work app for Medical Representatives. The app runs without Termux after the APK is installed and stores its database in Android app-private storage.

## Main workflow

**Search doctor or hospital → select result → GPS auto-fetch → mark product status → save meeting + 1 call**

Saved master information is reused automatically. A normal repeat meeting does not require re-entering doctor address, hospital, linked chemist, timing, date or time.

## Included features

- Offline SQLite phone database
- Search by doctor, hospital, linked chemist or address
- Doctor → hospital/clinic → linked chemist structure
- Doctor-wise meeting days and two meeting timings
- Available-now filter (within 60 minutes of a saved timing)
- One-tap current GPS capture with automatic current date/time
- Product-wise Prescribed / Not prescribed / No feedback
- Previous product status shown on the next meeting
- Follow-up date/time reminders and due follow-up list
- Automatic Today, This Month and Cumulative call counts
- Exact WhatsApp-ready daily report format
- Input, basket, towel, conversation, chemist availability and POB tracking
- Route plan in added order using saved doctor GPS; opens a multi-stop Maps route
- XLSX/CSV import with Doctor Name + Hospital duplicate merging
- Old MR Daily Auto JSON backup migration
- Manual backup/restore through Android's file picker (phone storage or a Drive provider)
- 4–8 digit PIN and optional platform fingerprint/face unlock
- 39 starter doctors, 106 chemists/stockists and 17 products

## Data safety

- Data is not sent to a server by this project.
- Clearing app storage or uninstalling the app deletes local data.
- Create regular `.mrbackup` files from **More → Backup & restore**.
- The app lock controls access to the UI. The SQLite database itself is not SQLCipher-encrypted.

## Build an APK

### Android Studio

1. Extract this folder.
2. Open `MR-FieldBook-Native` in Android Studio.
3. Allow Gradle sync and install Android SDK Platform 35 if prompted.
4. Select **Build → Build APK(s)**.
5. Install `app/build/outputs/apk/debug/app-debug.apk` on the Android phone.

### GitHub Actions

The included `.github/workflows/build-apk.yml` builds a debug APK automatically.

1. Upload the extracted project to a GitHub repository.
2. Open **Actions → Build Android APK → Run workflow**.
3. Download the `MR-FieldBook-v8-debug-apk` artifact.

## Import columns

The importer recognizes common variants of these columns:

`Doctor Name, Hospital/Clinic, Address, Chemist Name, Chemist Address, Meeting Days, Meeting Time 1, Meeting Time 2, Notes`

For old `.xls`, first use Excel or Google Sheets to save it as `.xlsx`. The supplied legacy data is already represented in the starter database.

## Package

- Application ID: `com.mrfieldbook.app`
- Minimum Android: API 28 (Android 9)
- Target/compile SDK: 35
- Java: 17
- No third-party runtime libraries
