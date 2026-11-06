-- FactorySearch v1.5 — optional, idempotent. Paste in the Supabase SQL Editor.
-- The public site does not depend on this file. Scorecard, Sources, and Study read catalog.js.
-- This file does not change Authentication site URL, job-portal tables, worksheets, weight prefs, or events.
-- It does not grant anon any privilege. Do not add anon policies.
-- Existing supplier ids are not updated (ON CONFLICT DO NOTHING), so the original 34 rows stay as they are.
-- Beijing Huade (B14) and Shandong Taifeng (B15) are intentionally absent: no confirmed ~700 bar bolting-pump line.

insert into public.fs_suppliers (id, category, name, country, region, what_they_make, us_presence, certs_note, url, url_check, cap, cert, scale, usexp, cost, lead, geo)
values
  ('C13', 'Forgings/Castings', 'Jiangsu Pacific Precision Forging (PPF)', 'China', 'China', 'Cold, warm, and hot precision-forged gears, gear shafts, and differential and special-shape forgings. Expanding into aluminium chassis forgings.', 'No US entity found. Worldwide-supplier wording is unverified and is not US shipment history.', 'IATF 16949 appears on a TUV Rheinland Certipedia record (special-shape forgings, transmission and differential gears). Expiry was not checked, so this is not a verified certificate.', 'https://www.ppforging.com/en/index.php/about.html', 200, 4, 5, 4, 2, 3, 2, 2)
  ('C14', 'Forgings/Castings', 'Jiangsu Leap Machine / Changzhou Leap Forging', 'China', 'China', 'Closed-die precision forgings 0.5-100 kg (up to 1.5 m), with in-house die making, heat treatment, and machining. Finished or semi-finished parts.', 'Export to North America is claimed in search summaries only. It was not found on the pages opened. Not verified shipments.', 'IATF 16949 is claimed on the company site. The certificate was not verified with a registrar.', 'https://en.leapmachine.com/', 200, 4, 4, 3, 2, 3, 2, 2)
  ('D10', 'Precision machining', 'Zhejiang Shuanghuan Driveline', 'China', 'China', 'Precision ground gears (ISO 6 / DIN 5 stated), gear components, transmission and robot-reducer gears, and industrial gearboxes. Gears for power tools are listed among applications.', 'A North American office in New Jersey is stated in the company ESG report. That statement is not verified US shipment history.', 'ISO 9001:2015 and IATF 16949:2016 are stated in the company ESG report. The certificates were not pulled from a registrar.', 'https://www.gearsnet.com/en/about.html', 200, 4, 4, 5, 4, 3, 2, 2)
  ('D11', 'Precision machining', 'Ningbo Xusheng Group', 'China', 'China', 'Aluminium and magnesium die-cast, forged, and extruded parts with CNC machining (five-axis and composite machining stated). EV drive, battery, chassis, and robot-system parts.', 'The company profile says manufacturing bases in the US, Mexico, and Thailand. Third-party customs lists were not checked. Not verified shipments.', 'IATF 16949 is cited by third-party sources only. Not verified.', 'https://www.nbxus.com/en/about.html', 200, 3, 3, 5, 5, 3, 3, 2)
on conflict (id) do nothing;

insert into public.fs_meta (key, value)
values ('china_pass', '2026-11-06')
on conflict (key) do nothing;

-- anon stays revoked on FactorySearch objects only. Job-portal tables are not named here.
revoke all on table public.fs_suppliers from anon, public;
revoke all on table public.fs_meta from anon, public;
revoke all on table public.fs_events from anon, public;
revoke all on table public.fs_worksheet from anon, public;
revoke all on table public.fs_weight_prefs from anon, public;

-- Trim authenticated down to what the site uses. RLS still applies.
-- TRUNCATE is not covered by RLS; PostgREST cannot call it, but the extra grant is removed here.
revoke all on table public.fs_suppliers from authenticated;
grant select on table public.fs_suppliers to authenticated;

revoke all on table public.fs_meta from authenticated;
grant select on table public.fs_meta to authenticated;

revoke all on table public.fs_events from authenticated;
grant select, insert on table public.fs_events to authenticated;

revoke all on table public.fs_worksheet from authenticated;
grant select, insert, update on table public.fs_worksheet to authenticated;

revoke all on table public.fs_weight_prefs from authenticated;
grant select, insert, update on table public.fs_weight_prefs to authenticated;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'fs_usage_summary'
  ) then
    execute 'revoke all on table public.fs_usage_summary from anon, authenticated, public';
    execute 'grant select on table public.fs_usage_summary to authenticated';
  end if;
end $$;
