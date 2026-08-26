# MR One v1.9.2 — GitHub Cloud Sign-In

- Added Supabase GitHub OAuth sign-in to Super Admin → Cloud sync.
- Email/password remains available as a fallback.
- Render/browser OAuth returns to the deployed app URL.
- Android APK OAuth returns through `mrone://auth/callback` and restores the Supabase session inside the WebView.
- Added Android deep-link intent handling with `singleTop` activity mode.
- Bumped service-worker cache for reliable Render rollout.
- Version: 192 / 1.9.2.

Supabase project setup still requires enabling GitHub under Authentication → Providers using a GitHub OAuth App Client ID/Secret and allow-listing the Render URL plus `mrone://auth/callback`. Secret credentials stay in Supabase/GitHub only; they are never stored in MR-One frontend code.
