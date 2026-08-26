# MR-One v1.9.5 — Simple Supabase Password Auth

- Replaced magic-link/OTP/GitHub primary cloud login with email + password.
- Added Create account and Sign in actions directly in Super Admin Cloud Sync.
- Added password show/hide control and client-side credential validation.
- Removed active magic-link/OTP request code from cloud auth module.
- Cloud configuration, RLS-backed sync, first-device upload, and sign-out remain unchanged.
- For email-free first-time signup, Supabase mandatory email confirmation must be disabled.
