-- FactorySearch migration v1.2 — run AFTER schema_fs_v1.sql. Adds reviewer login philos@greymatterfusion.com.
-- Replaces only the fs_allowed() helper; job-portal tables are unaffected (their policies name philoskim990@gmail.com directly).
create or replace function public.fs_allowed() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) = any (array['philoskim990@gmail.com','philos@greymatterfusion.com'])
$$;
