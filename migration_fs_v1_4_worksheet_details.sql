-- FactorySearch migration v1.4 — structured worksheet fields. Run AFTER v1.3. Additive only.
-- Adds one nullable JSONB column to fs_worksheet. Existing status / evidence rows are untouched.
-- Adding a nullable column without a default is a metadata-only change in Postgres (no table rewrite).
alter table public.fs_worksheet add column if not exists details jsonb;

-- Guardrails: must be a JSON object and stay small (about 16 KB per gate row).
alter table public.fs_worksheet drop constraint if exists fs_worksheet_details_shape;
alter table public.fs_worksheet add constraint fs_worksheet_details_shape
  check (details is null or (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 20000));

-- Existing table grants and RLS policies (fs_allowed()) already cover the new column; nothing else changes.
-- Ask the Data API to pick up the new column right away:
notify pgrst, 'reload schema';
