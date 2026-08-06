# Validation — MR Machine Intelligence v14.5

## Passed in this delivery

- `app.js` passes `node --check`.
- Android manifest and web manifest parse as XML/JSON.
- `android.useAndroidX=true` remains enabled.
- Gradle `plugins {}` block remains first in `app/build.gradle`.
- App version is `14.5.0` / versionCode `145`.
- Android manifest declares the visible overlay permission and Android 14 special-use foreground-service type.
- SAN overlay service includes a draggable MR bubble, editable paste box, clipboard-on-tap action, send-to-app action and stop action.
- SAN copied text is reviewed and parsed before it can pre-fill Log Meeting.
- Meeting chemist selection is searchable by name, area and address.
- Doctor route ordering is strict nearest-chain from each previous stop; timing conflict is a warning only.
- Premium transitions and native haptic bridge are included.
- Accepted/placed orders with pending fulfilment remain included in distributor planning.
- Doctors sharing the same hospital/place/map coordinate remain grouped into one route stop.

## Still requires GitHub/phone verification

- Android APK compilation and dependency resolution on GitHub Actions.
- First-time “Display over other apps” permission flow on the user’s phone.
- Overlay behavior over the installed SAN app; protected screens may block overlays.
- Clipboard paste behavior on the user’s Android/OxygenOS build.
- Haptic strength and premium transition feel on the user’s phone.
- Google Maps route opening with real verified coordinates.
- Live Google Places results when `PLACES_API_KEY` is configured.

## Routing rule

The selected start doctor/hospital is the origin. The next stop is the geographically nearest remaining verified hospital. After reaching that stop, the next selection is recalculated from that stop, continuing until all eligible stops are ordered. Timing conflicts are displayed but do not cause the route to jump over a nearer location. Google Maps calculates the final road route; in-app distance remains an approximate straight-line estimate.

- SAN bulk detector and representative vertical/tabular doctor-master parser smoke-tested.
