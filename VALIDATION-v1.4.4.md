# MR One v1.4.4 validation

## Static validation
- JavaScript syntax (`node --check`): PASS.
- AndroidManifest XML parse: PASS.
- GitHub workflow YAML parse: PASS.
- Java source lexical bracket balance: PASS.
- `versionCode 144` / `versionName 1.4.4`: PASS.
- `REQUEST_INSTALL_PACKAGES` present: PASS.
- Native bridges present: version info, update check, download, install downloaded APK: PASS.
- GitHub Release API endpoint present: PASS.
- APK download accepts HTTPS `github.com` release URL only: PASS.
- Release-signing secrets are never stored in source: PASS.
- Workflow builds `assembleRelease`, uploads artifact, and publishes versioned GitHub Release: PASS.
- Free OSM address/nearby implementation retained: PASS.

## Deterministic updater scenarios
- Same version => up to date: PASS.
- Higher patch/minor/major version => update available: PASS.
- Older release => no downgrade prompt: PASS.
- HTTPS GitHub release APK => accepted: PASS.
- HTTP/non-GitHub update URL => blocked: PASS.
- SHA-256 release digest, when supplied by GitHub, is verified before installer launch: implemented and statically verified.
- Digest mismatch => downloaded file removed and install blocked: implemented and statically verified.
- Android 8+ unknown-source permission missing => opens app-specific permission screen: implemented and statically verified.
- Permission granted on return => resumes pending downloaded update: implemented and statically verified.

## Important build/signing gate
A real Android release APK was not compiled in this container. v1.4.4 intentionally requires the persistent signing secrets in GitHub Actions; the first GitHub Actions build is the final Android compile/sign/release gate.

Older v1.4.3 and earlier GitHub-runner debug builds may have a different signing certificate. Export Full backup before the first stable-signed v1.4.4 install. If Android reports a signature mismatch, uninstall MR One once, install v1.4.4, and restore the JSON backup. Future stable-signed updates can then install in place.
