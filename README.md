# FactorySearch v1.2.1
Password-gated HYTORC supplier scorecard + qualification worksheet (Philos Kim / Teddy Hume). Static site on Netlify, data in Supabase (`fs_*` tables, same project as the job portal).

## Setup (once)
1. **Schema:** Supabase → SQL Editor → paste all of `schema_fs_v1.sql` → Run.
2. **Seed:** `SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/seed_fs.py` (34 suppliers + data_as_of/version). Never commit the key.
3. **Auth:** Philos already has an Auth user in this project (job portal) — reuse it; no new account. Email/password provider must be enabled and that user must have a password set (if it was magic-link only, set one via Users → ⋯ → Send password recovery). The site never creates users.
4. **URL config:** Authentication → URL Configuration → add the Netlify URL (e.g. `https://factorysearch.netlify.app`) to Redirect URLs (Site URL can stay as job portal).
5. **Owner analytics (optional):** run `migration_fs_v1_1_owner_analytics.sql` so Philos can see all users' `fs_events` and `fs_usage_summary`.
6. **Netlify:** project FactorySearch → Link repo `Nobugawa/FactorySearch`, branch `main`, build command empty, publish `.`.

## Adding Teddy
1. Auth → Add user with Teddy's email + password; share the password privately.
2. `config.js` → add his email to `ALLOWED_EMAILS`.
3. SQL Editor: re-run `fs_allowed()` from the schema with his email added to the array.
4. Commit + push (Netlify redeploys).

## Analytics
`fs_events` logs session_start, session_ping (seconds; 60s heartbeat, tab hidden, unload), supplier_open, source_click, worksheet_open/save. Query in SQL Editor, e.g.
`select user_email, event_type, count(*), max((detail->>'seconds')::int) from fs_events group by 1,2;`

## Tests
`node tests/rebalance.test.js`, `node tests/auth_url.test.js`, `NODE_PATH=<jsdom node_modules> node tests/dom.test.js` — weight rebalance invariants (sum 100, locks fixed, clamps, zero-sum, typed input, fuzz).

## Usage notice
The login screen and footer tell users their activity is logged and visible to the owner.

## Reviewer login (philos@greymatterfusion.com)
Sees exactly what Teddy will (no owner analytics). Auth user exists (confirmed, no password yet). Run `migration_fs_v1_2_reviewer.sql`.
Password setup: add `https://factorysearch.netlify.app/**` to Supabase Auth → URL Configuration → Redirect URLs, then generate a recovery link with redirect `https://factorysearch.netlify.app/?setup=1`. The site detects it, shows *Set your password*, and clears the token from the URL.

## Sources view
`#/sources` explains the original desk-research method, what was not done, and per-supplier evidence. Per-supplier discovery trail was not recorded and is labeled that way. Homepage re-check results (fs_meta `homepage_recheck`) are newly done checks, not original discovery.
