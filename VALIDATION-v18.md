# v18 validation

Static validation performed in this environment:
- JavaScript syntax: node --check app.js
- XML parse: AndroidManifest.xml
- No SanOverlayService.java in source
- No SYSTEM_ALERT_WINDOW / foreground overlay permission
- No Google Places SDK dependency/imports/API-key placeholders
- No runtime bundled .xls seed path
- App versionCode 180 / versionName 18.0.0
- ZIP integrity checked after packaging

Full Android Gradle compilation must be confirmed by GitHub Actions/Android SDK environment.
