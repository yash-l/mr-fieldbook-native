# MR-One v1.9.4 — Secure Email Link Cloud Sign-In

- Uses the confirmation/magic link Supabase already sends; no OTP email-template change required.
- Removed 6-digit OTP entry from the primary Cloud Sync UI.
- Added automatic callback session detection.
- Render/browser returns to the current deployed page. Android requests `mrone://auth/callback`.
- Added 60-second resend cooldown and clear rate-limit handling.
- Email/password remains available as a fallback.
