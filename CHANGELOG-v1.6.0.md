# MR One v1.6.0 — Fast Call UX

## Goal
Reduce field-entry friction for repeat doctor calls while preserving all existing MR One data, reports and advanced workflows.

## Changes
- Routine doctor call is now outcome-first and compact.
- Voice capture is collapsed by default and remains one tap away.
- Saved hospital / chemist / timing master data is collapsed when already complete; it opens automatically when completion is needed.
- Hospital GPS verification is moved into an optional compact section.
- Existing doctor product status remains prefilled; MR only taps what changed.
- Added one-tap follow-up presets: Tomorrow, +3 days, +7 days, Clear.
- Not-met outcomes change the save CTA to `Save attempt + next action` and retain automatic reschedule/replacement intelligence.
- A real doctor attempt can now be saved even when hospital/chemist master data is incomplete. Missing master data stays pending instead of blocking field logging.
- Meeting summary now surfaces last recorded call and pending follow-up at a glance.
- Larger primary save target and faster mobile touch targets.

## Compatibility
No database/storage schema reset. Existing v1.5.5 state remains compatible.
