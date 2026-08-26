# MR-One v1.9.1 — Admin Cloud Configuration

- Added Super Admin > Cloud Configuration for Supabase Project URL and Publishable/legacy anon key.
- Added masked key display with Show/Hide control.
- Added credential validation and live Supabase connection test before saving.
- Rejects `sb_secret_*` and service-role credentials from frontend configuration.
- Stores Admin-entered public cloud credentials in device/browser localStorage, avoiding Git commits containing keys.
- Added clear/remove configuration without touching local MR data.
- Supabase client can be reset/reconfigured at runtime after Admin saves new credentials.
- Bumped service-worker cache to force Render clients onto the new admin/cloud UI.
