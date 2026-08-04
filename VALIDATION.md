# Validation

- Exact v7 `styles.css` retained unchanged.
- Exact v7 page structure retained; only the remote XLSX script and page-version title were changed.
- v7 JavaScript syntax checked with `node --check` after Android bridge additions.
- Android source reduced to a WebView host plus offline spreadsheet parser; old different native screens were removed.
- GPS, file picker, native share, clipboard, save picker and SHA-256 PIN bridge paths are wired.
- No remote JavaScript is required for normal app startup or `.xlsx`/CSV import.
- Static Java parse check found no Java syntax errors; Android symbol resolution requires the GitHub Android build.
- Final APK must still be tested on the target phone for Android location permission, file picker and OEM-specific WebView behavior.
