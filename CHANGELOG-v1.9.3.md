# MR One v1.9.3 — Email OTP Cloud Sync

- Replaced GitHub OAuth as the primary Cloud Sync login with passwordless Email OTP.
- Added Send login code, 6-digit OTP verification, resend, one-time-code autocomplete, validation and error states.
- Kept email/password authentication only as a fallback for existing accounts.
- Removed the GitHub OAuth dependency from the primary MR-One cloud flow.
- Bumped service-worker cache to `mr-one-shell-v193-email-otp`.
- Android version: `versionCode 193`, `versionName 1.9.3`.

Supabase note: for a visible six-digit email OTP, the project's email template must include the Supabase token placeholder rather than only a magic-link URL.
