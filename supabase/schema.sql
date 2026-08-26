-- MR-One cloud schema — Supabase (PostgreSQL + Row Level Security)
-- Run this once in the Supabase SQL editor for a new project.
--
-- Design notes:
-- * Primary keys are TEXT, not UUID. MR-One already generates its own stable
--   string ids locally (e.g. "dnote_1a2b3c") via uid() in app.js, before the
--   device ever has network access. Reusing those ids as the primary key
--   means the offline-first sync layer can upsert by id with zero id-mapping
--   step between local storage and the cloud — a doctor added offline today
--   and synced tomorrow keeps the exact same id everywhere.
-- * Every table has user_id + RLS "owner can read/write only their own rows".
--   This is deliberately per-MR data isolation, not a shared team database —
--   matches "users would only see their own records" from the brief.
-- * created_at / updated_at are used for last-write-wins conflict resolution
--   on mutable tables (doctors, pharmacies, plans). Append-heavy tables
--   (doctor_notes, doctor_prescriptions, pharmacy_products, visits) are
--   treated as append-only by the sync layer — see cloud/conflict.js.

create extension if not exists pgcrypto;

-- ===================== doctors =====================
create table if not exists doctors (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  hospital_name text,
  speciality text,
  core_category text check (core_category in ('C','NC') or core_category is null),
  area text,
  mobile text,
  monthly_visit_target int,
  min_visit_gap_days int,
  meeting_days jsonb,
  product_focus text,
  gps jsonb,
  raw jsonb not null default '{}'::jsonb, -- full local record, for fields not modeled individually above
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== doctor_notes (separate from visit notes) =====================
create table if not exists doctor_notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  doctor_id text not null,
  date date,
  note text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== doctor_prescriptions (most-written/most-prescribed) =====================
create table if not exists doctor_prescriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  doctor_id text not null,
  date date,
  products jsonb not null default '[]'::jsonb, -- [{product, qty}]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== pharmacies (chemists) =====================
create table if not exists pharmacies (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  area text,
  mobile text,
  gps jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== pharmacy_products (availability, separate from visit notes) =====================
create table if not exists pharmacy_products (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pharmacy_id text not null,
  product text not null,
  available boolean default true,
  qty numeric default 0,
  notes text,
  last_checked_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== visits (doctor/chemist meeting log) =====================
create table if not exists visits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text check (entity_type in ('doctor','chemist')),
  entity_id text not null,
  date date,
  status text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== plans (30-day advance plan) =====================
create table if not exists plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  items jsonb not null default '[]'::jsonb,
  generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== patches (date-wise smart patch / confirmed daily plan) =====================
create table if not exists patches (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date,
  status text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== monthly_business (sales targets / weekly business) =====================
create table if not exists monthly_business (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text check (kind in ('sales_month','weekly_business')),
  period text, -- e.g. '2026-08' or a week key
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================== imports (import history / audit trail) =====================
create table if not exists imports (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text,
  summary jsonb,
  created_at timestamptz default now()
);

-- ===================== user_settings (profile, settings, feature flags, custom filters) =====================
-- Singleton per user — these are config, not a list of records, so it's one row per
-- account rather than a table of independent items. Last-write-wins on the whole blob.
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blob jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ===================== sync_log (per-device sync audit trail) =====================
create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  direction text check (direction in ('push','pull')),
  table_name text,
  row_count int default 0,
  status text check (status in ('ok','error')),
  detail text,
  created_at timestamptz default now()
);

-- ===================== updated_at auto-touch trigger =====================
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['doctors','doctor_notes','doctor_prescriptions','pharmacies','pharmacy_products','visits','plans','patches','monthly_business','user_settings']
  loop
    execute format('drop trigger if exists trg_touch_updated_at on %I;', t);
    execute format('create trigger trg_touch_updated_at before update on %I for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ===================== Row Level Security =====================
do $$
declare t text;
begin
  foreach t in array array['doctors','doctor_notes','doctor_prescriptions','pharmacies','pharmacy_products','visits','plans','patches','monthly_business','imports','sync_log','user_settings']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on %I;', t);
    execute format(
      'create policy "owner_all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;

-- Helpful indexes for the sync layer's incremental pull (updated_at cursor)
create index if not exists idx_doctors_user_updated on doctors (user_id, updated_at);
create index if not exists idx_doctor_notes_user_updated on doctor_notes (user_id, updated_at);
create index if not exists idx_doctor_rx_user_updated on doctor_prescriptions (user_id, updated_at);
create index if not exists idx_pharmacies_user_updated on pharmacies (user_id, updated_at);
create index if not exists idx_pharmacy_products_user_updated on pharmacy_products (user_id, updated_at);
create index if not exists idx_visits_user_updated on visits (user_id, updated_at);
create index if not exists idx_plans_user_updated on plans (user_id, updated_at);
create index if not exists idx_patches_user_updated on patches (user_id, updated_at);
create index if not exists idx_monthly_business_user_updated on monthly_business (user_id, updated_at);
