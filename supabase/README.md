# MR-One cloud sync — setup

Architecture: Render (static frontend) → Supabase (Auth + Postgres + RLS).
Local storage stays primary; Supabase is a sync layer, not a replacement.
The app works fully offline with cloud sync off — nothing here is required.

## What I could and couldn't verify from my side

I don't have network access to supabase.com from my sandbox (same restriction
that blocked `git clone github.com` earlier in this conversation), so:

- ✅ Verified: all JS files pass `node --check` (no syntax errors)
- ✅ Verified: the full existing app test suite (17 checks) still passes with
  these files loaded and cloud sync disabled — nothing broke
- ✅ Verified: when `cloud/config.js` has empty keys, the app detects that and
  skips all cloud code paths cleanly (confirmed via headless browser test,
  including the supabase-js CDN script itself failing to load in my sandbox —
  the app didn't crash, it just ran local-only, as designed)
- ❌ NOT verified: an actual round-trip against a live Supabase project —
  I have no way to create or reach one from here. That first real test has
  to happen on your end. See "Test checklist" below.

## Setup steps

1. **Create a Supabase project** at supabase.com (free tier is fine to start).

2. **Run the schema.** Open your project → SQL Editor → paste the entire
   contents of `supabase/schema.sql` → Run. This creates all 11 tables,
   enables Row Level Security on every one of them, and adds the policy
   that a user can only ever read/write rows where `user_id = auth.uid()`.

3. **Turn on email auth** (usually on by default): Project Settings →
   Authentication → Providers → Email. For testing, you can disable
   "Confirm email" under Authentication → Settings so sign-up works
   immediately without a confirmation email round-trip.

4. **Get your keys**: Project Settings → API →
   - `Project URL`
   - `anon` `public` key (NOT `service_role` — never use that one here)

5. **Fill in `app/src/main/assets/web/cloud/config.js`**:
   ```js
   window.MR_ONE_CLOUD_CONFIG = {
     supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
     supabaseAnonKey: 'eyJ...your-anon-key...',
     enabled: false // this line is recalculated automatically, leave it
   };
   ```

6. **Commit and push** (same flow as before — this file lives inside the
   `web/` folder Render already deploys):
   ```bash
   git add -A
   git commit -m "Enable Supabase cloud sync"
   git push origin main
   ```

7. Once deployed, open the app → bottom nav → **Admin** → unlock Super
   Admin → you'll now see a **Cloud sync** card with sign-in fields.

## What syncs across devices

Every local data type now has cloud coverage — this was a real gap found and fixed
during testing (see "Known limitations" below for the one thing that isn't covered):

| Local data | Cloud table | Merge strategy |
|---|---|---|
| Doctors | `doctors` | last-write-wins by id |
| Chemists | `pharmacies` | last-write-wins by id |
| Doctor notes | `doctor_notes` | append-safe, newest-wins by id |
| Prescription records | `doctor_prescriptions` | append-safe, newest-wins by id |
| Pharmacy product availability | `pharmacy_products` | append-safe, newest-wins by id |
| Visit/meeting log | `visits` | append-safe, newest-wins by id |
| Confirmed patch plans | `patches` | last-write-wins by id |
| 30-day advance plan | `plans` | last-write-wins by (synthetic) id |
| Sales targets & weekly business | `monthly_business` | last-write-wins by (synthetic) id |
| Import history | `imports` | append-only |
| Profile, settings, feature flags, custom doctor filters | `user_settings` | **pull-then-push**, whole-blob last-write-wins (see note below) |

**Why `user_settings` is pull-then-push and everything else is push-then-pull:**
this was an actual bug caught by `sync-coverage-verify.js` during testing. Every other
table is a list of independently-identified rows, so pushing your own copy first is
harmless — it just upserts your own rows by id and doesn't touch anyone else's.
`user_settings` is a *single* row shared by every device on the account. Pushing your
local copy first — before checking what's already in the cloud — would silently
overwrite a genuinely newer settings change from another device with your own stale
one. Pulling first, applying it locally, and only then pushing (the now-merged) copy
back up avoids that. If you ever add another "one row per account" table, copy this
pattern, not the per-record one.



## Test checklist (do this after step 7)

1. Sign up with a test email/password on Phone 1 (or a desktop browser tab).
2. Tap **"Upload this device's data"** — this pushes everything currently
   local up to Supabase once.
3. In the Supabase dashboard → Table Editor → `doctors` — confirm rows
   appear with your `user_id`, and that RLS is on (there's a padlock icon
   next to the table name).
4. On a second device/browser, sign in with the **same** account.
5. Wait a few seconds (or tap **Sync now**) — the second device should pull
   down the doctors/chemists/records from the first device.
6. Add a doctor on device 2, tap Sync now on device 1 — confirm it appears
   there too.
7. Turn off wifi/data on one device, add a doctor, confirm it still saves
   instantly (this is the local-first guarantee — it should never block on
   network). Turn network back on, confirm it syncs up within a few seconds
   or on the next "Sync now" tap.
8. Try signing in with a different account — confirm you do **not** see the
   first account's doctors (this is RLS actually doing its job, not just
   the UI hiding them — worth checking directly in the Supabase Table
   Editor with "Impersonate" off too, if you want to be thorough).

## Known limitations (first version — be aware of these)

- **Deletes don't sync.** Deleting a doctor/note/etc. on one device removes
  it locally only; it stays in Supabase and on other devices. This was a
  deliberate choice to avoid a merge accidentally destroying real data —
  see the comment block at the top of `cloud/conflict.js`. A future version
  could add a tombstone table if you want real delete propagation.
- **Sync is snapshot-based, not fully field-level.** Every table pushes its
  full local snapshot on a debounce (4s after your last local change), not
  individual field-level diffs. Fine at MR-scale data volumes (dozens to a
  few hundred records); would need more granular change-tracking if this
  ever needed to scale to thousands of rows per user.
- **No admin-side visibility across users yet** — each MR only ever sees
  their own data via RLS, matching "users would only see their own records"
  from the brief. A manager/company-wide view would need a separate
  service-role-backed API (never exposed to the frontend) — out of scope
  for this pass, ask if you want that built next.
