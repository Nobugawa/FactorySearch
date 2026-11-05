-- FactorySearch schema v1 — paste once in Supabase SQL Editor (same project as job portal).
-- All tables prefixed fs_ ; job-hunt tables are untouched and stay invisible to Teddy.
-- TO ADD TEDDY: edit the array in fs_allowed() below, e.g.
--   array['philoskim990@gmail.com','teddy@example.com']  then re-run just that function.

create or replace function public.fs_allowed() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) = any (array['philoskim990@gmail.com'])
$$;

create table if not exists public.fs_suppliers (
  id text primary key, category text, name text not null, country text, region text,
  what_they_make text, us_presence text, certs_note text, url text, url_check int,
  cap int, cert int, scale int, usexp int, cost int, lead int, geo int,
  updated_at timestamptz not null default now());
create table if not exists public.fs_meta (key text primary key, value text);
create table if not exists public.fs_events (
  id uuid primary key default gen_random_uuid(), user_email text not null, event_type text not null,
  supplier_id text, detail jsonb default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists fs_events_user_idx on public.fs_events(user_email, created_at);
create table if not exists public.fs_worksheet (
  supplier_id text not null, gate_id text not null, status text, evidence text,
  updated_by text, updated_at timestamptz not null default now(), primary key (supplier_id, gate_id));
create table if not exists public.fs_weight_prefs (
  user_email text primary key, weights int[] not null, locked boolean[] not null,
  updated_at timestamptz not null default now());

alter table public.fs_suppliers enable row level security;
alter table public.fs_meta enable row level security;
alter table public.fs_events enable row level security;
alter table public.fs_worksheet enable row level security;
alter table public.fs_weight_prefs enable row level security;

revoke all on public.fs_suppliers, public.fs_meta, public.fs_events, public.fs_worksheet, public.fs_weight_prefs from anon;
grant select on public.fs_suppliers, public.fs_meta to authenticated;
grant select, insert on public.fs_events to authenticated;
grant select, insert, update on public.fs_worksheet, public.fs_weight_prefs to authenticated;

drop policy if exists fs_suppliers_sel on public.fs_suppliers;
create policy fs_suppliers_sel on public.fs_suppliers for select to authenticated using (public.fs_allowed());
drop policy if exists fs_meta_sel on public.fs_meta;
create policy fs_meta_sel on public.fs_meta for select to authenticated using (public.fs_allowed());

drop policy if exists fs_events_ins on public.fs_events;
create policy fs_events_ins on public.fs_events for insert to authenticated
  with check (public.fs_allowed() and lower(user_email) = lower(auth.jwt() ->> 'email'));
drop policy if exists fs_events_sel on public.fs_events;
create policy fs_events_sel on public.fs_events for select to authenticated
  using (lower(user_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists fs_ws_sel on public.fs_worksheet;
create policy fs_ws_sel on public.fs_worksheet for select to authenticated using (public.fs_allowed());
drop policy if exists fs_ws_ins on public.fs_worksheet;
create policy fs_ws_ins on public.fs_worksheet for insert to authenticated with check (public.fs_allowed());
drop policy if exists fs_ws_upd on public.fs_worksheet;
create policy fs_ws_upd on public.fs_worksheet for update to authenticated using (public.fs_allowed()) with check (public.fs_allowed());

drop policy if exists fs_wp_sel on public.fs_weight_prefs;
create policy fs_wp_sel on public.fs_weight_prefs for select to authenticated using (lower(user_email) = lower(auth.jwt() ->> 'email'));
drop policy if exists fs_wp_ins on public.fs_weight_prefs;
create policy fs_wp_ins on public.fs_weight_prefs for insert to authenticated with check (public.fs_allowed() and lower(user_email) = lower(auth.jwt() ->> 'email'));
drop policy if exists fs_wp_upd on public.fs_weight_prefs;
create policy fs_wp_upd on public.fs_weight_prefs for update to authenticated
  using (lower(user_email) = lower(auth.jwt() ->> 'email')) with check (lower(user_email) = lower(auth.jwt() ->> 'email'));
