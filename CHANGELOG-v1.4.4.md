# MR One v1.4.4 — Fast in-app update

- Added Tools → App update.
- Checks the latest public GitHub Release directly from the Android app.
- Downloads the signed APK with Android DownloadManager.
- Uses GitHub release SHA-256 digest when available before opening installer.
- Opens Android package installer after download; user still confirms Update.
- Handles Android 8+ "Install unknown apps" permission for MR One.
- Added stable release signing support via GitHub Actions secrets.
- GitHub Actions now builds a signed release APK and publishes it as a versioned GitHub Release.
- Existing field data schema is unchanged.
- Google Places remains optional; free OSM GPS/nearby flows remain intact.
