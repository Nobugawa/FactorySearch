-- OPTIONAL hardening for existing job-portal tables (review before running; not required for FactorySearch).
-- Today authenticated has TRUNCATE/TRIGGER/REFERENCES grants on job tables. RLS does not govern TRUNCATE.
-- Not reachable through the Data API (PostgREST has no TRUNCATE), but revoking is defense in depth before adding a 2nd user.
revoke truncate, trigger, references on
  public.action_items, public.activities, public.app_meta, public.applications, public.companies,
  public.contacts, public.interactions, public.portal_actions, public.user_notes
from authenticated;
