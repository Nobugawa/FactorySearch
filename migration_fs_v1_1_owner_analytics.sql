-- FactorySearch migration v1.1 — run AFTER schema_fs_v1.sql. Separate from the delivered v1 schema.
-- Lets the portal owner (Philos) read ALL fs_events rows (incl. Teddy's usage). Other users still see only their own.
drop policy if exists fs_events_owner_sel on public.fs_events;
create policy fs_events_owner_sel on public.fs_events for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'philoskim990@gmail.com');
-- Optional: events are append-only (no UPDATE/DELETE grants exist in v1). Usage summary view for the owner:
create or replace view public.fs_usage_summary with (security_invoker = true) as
  select user_email, date_trunc('day', created_at)::date as day,
         count(*) filter (where event_type = 'session_start') as sessions,
         max((detail ->> 'seconds')::int) as max_session_seconds,
         count(*) filter (where event_type = 'supplier_open') as supplier_opens,
         count(*) filter (where event_type = 'source_click') as source_clicks,
         count(*) filter (where event_type = 'worksheet_save') as worksheet_saves
  from public.fs_events group by 1, 2;
revoke all on public.fs_usage_summary from anon;
grant select on public.fs_usage_summary to authenticated;
