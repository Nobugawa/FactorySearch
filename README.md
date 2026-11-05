# FactorySearch v1.0.0
Password-gated HYTORC supplier scorecard + qualification worksheet (Philos Kim / Teddy Hume). Static site on Netlify, data in Supabase (`fs_*` tables, same project as the job portal).

## Setup (once)
1. **Schema:** Supabase → SQL Editor → paste all of `schema_fs_v1.sql` → Run.
2. **Seed:** `SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/seed_fs.py` (34 suppliers + data_as_of/version). Never commit the key.
3. **Auth:** Supabase → Authentication → Providers → Email enabled (password). Users → *Add user* → create `philoskim990@gmail.com` with a password (auto-confirm). Sign-ups are not created from the site.
4. **URL config:** Authentication → URL Configuration → add the Netlify URL (e.g. `https://factorysearch.netlify.app`) to Redirect URLs (Site URL can stay as job portal).
5. **Netlify:** project FactorySearch → Link repo `Nobugawa/FactorySearch`, branch `main`, build command empty, publish `.`.

## Adding Teddy
1. Auth → Add user with Teddy's email + password; share the password privately.
2. `config.js` → add his email to `ALLOWED_EMAILS`.
3. SQL Editor: re-run `fs_allowed()` from the schema with his email added to the array.
4. Commit + push (Netlify redeploys).

## Analytics
`fs_events` logs session_start, session_ping (seconds; 60s heartbeat, tab hidden, unload), supplier_open, source_click, worksheet_open/save. Query in SQL Editor, e.g.
`select user_email, event_type, count(*), max((detail->>'seconds')::int) from fs_events group by 1,2;`
