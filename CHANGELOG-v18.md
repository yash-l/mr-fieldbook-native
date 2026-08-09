# v18 — Offline Field Intelligence

- Removed Google Places SDK/API-key dependency; nearby mapping is phone GPS + saved doctor/hospital GPS only.
- Removed all remaining SAN overlay code/styles and background overlay permissions/services.
- Foreground current GPS refresh becomes the primary planning anchor; no background tracking.
- Dynamic Not Met replacement is persisted into today's patch and the missed doctor is moved to the next valid meeting slot.
- Successful visit policy enforced: max 2 visits/month and minimum 15 days between successful meetings.
- Replacement selection: available-now first, then nearest by straight-line saved GPS distance.
- Route mode is strict nearest-neighbor from the current/previous stop; timing risk is a warning, not a silent distance override.
- Self-learning strengthened with recency-weighted meet rate, weekday/time performance, trend and confidence scoring.
- Mapping confidence uses saved GPS accuracy and preserves explicit field verification source.
- Removed dead bundled SheetJS startup loader and bundled .xls import path from runtime logic.
