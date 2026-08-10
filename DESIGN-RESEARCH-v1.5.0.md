# Design research notes — v1.5.0

The redesign was informed by current platform guidance and seller-mobile patterns:
- Apple HIG: use haptics intentionally, consistently, briefly, and make them optional.
- Android haptics guidance: prefer action-oriented system haptic constants over raw one-shot vibration.
- Android mobile design: keep navigation/body clear and use familiar containment patterns.
- Salesforce seller-focused mobile: prioritize the day’s visits/tasks on Home and show important record details first.
- Google Maps URLs: keyless Maps search links can launch Google Maps with `api=1&query=...`, but they do not return structured place data to the app.
- Google Places Text Search: optional structured automatic place matching when a Places API key is configured.
