-- FactorySearch migration v1.3 — adds Teddy Hume (thume@hytorc.com). Run AFTER v1.2. Preserves owner + reviewer.
-- Replaces only fs_allowed(); job-portal tables are unaffected.
create or replace function public.fs_allowed() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) = any (array['philoskim990@gmail.com','philos@greymatterfusion.com','thume@hytorc.com'])
$$;
