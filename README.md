# FactorySearch v1.4.2

Public HYTORC supplier scorecard, Sources, and Study, plus a private qualification worksheet. Static site on Netlify. Research rows ship in `catalog.js`. Shared worksheet notes, per-account weights, and email-linked activity stay in Supabase (`fs_*` tables, same project as the job portal).

Anonymous visitors are not granted database access. The publishable key in `config.js` is not a service-role key. GA4 stays off (`GA4_MEASUREMENT_ID` is empty).

## What is public
Scorecard, Sources, and Study render from `catalog.js` (the original 34 suppliers, snapshotted from the database without worksheet or account fields, plus four Nov 6, 2026 China candidates). Anonymous weight changes stay in `localStorage`. They are not written to `fs_weight_prefs`, `fs_suppliers`, or `fs_events`.

v1.4.2 presents one list of Chinese and non-Chinese manufacturers. It does not add a separate China chapter, and it does not change scores, weights, or the database. Cost, lead time, and geography remain indicative assumptions, not quotations or measured outcomes. Suggested 1-5 scores are preliminary desk judgments. A US office is not verified shipment history. A certificate named on a page, or a registrar row whose expiry was not checked, is not a verified certificate. Price, MOQ, and volume willingness were not found. Each supplier keeps its own source date. Desk research dates remain Nov 2, 2026 and Nov 6, 2026.

Beijing Huade and Shandong Taifeng are not on the scorecard. A ~700 bar bolting-pump line was not confirmed, so they are not qualified bolting-pump matches. They are on the unscored watchlist with TZ Yuci.

## What stays private
Signed-in editors (the emails in `config.js`, matched again by `fs_allowed()` on the JWT email claim) can open the shared worksheet and save their own weights. Session time, supplier rows opened, source clicks, and worksheet saves are stored in `fs_events` and linked to that email. The footer states this only while someone is signed in. Browsing while signed out is not written to the database.

`fs_events`, `fs_worksheet`, `fs_weight_prefs`, and the job-portal tables are not in `catalog.js`.

## Rollout
1. Merge the PR when you want Netlify to publish it. Public pages work from `catalog.js` immediately. This repo does not apply SQL for you.
2. Optional, in the Supabase SQL Editor for project `vixnrugeiclzukzickmq`: paste `migration_fs_v1_5_china_candidates.sql` and run it once. It is idempotent. It inserts C13, C14, D10, and D11 only when those ids are missing, and it revokes extra privileges on `fs_*` only. It does not update the original 34 rows, worksheets, weight prefs, or events. It does not grant `anon` anything. It does not change Auth Site URL or any job-portal table.
3. Do not re-run `schema_fs_v1.sql` on the live project unless you intend to recreate policies. The function in that file now lists the same three editors as the live `fs_allowed()`.
4. Leave GA4 blank. Do not create accounts or send email from this change.

Until step 2 is run, the scorecard still shows the four China names because they live in `catalog.js`. The `fs_suppliers` table will not list them yet. Worksheet saves for those ids do not need a foreign key. `authenticated` still has broad table grants (including `TRUNCATE`, which RLS does not cover and PostgREST cannot call) until step 2 revokes them. Row access remains limited by the existing policies.

## Setup (already done on the live project)
1. **Schema:** was applied from `schema_fs_v1.sql`. Do not grant `anon` access to `fs_*`.
2. **Seed:** `SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/seed_fs.py` inserts missing rows and does not overwrite existing ones. Never commit the key.
3. **Auth:** reuse the existing Auth users. The site never creates users.
4. **URL config:** Authentication → URL Configuration → Redirect URLs include `https://factorysearch.netlify.app/**`. Site URL can stay the job portal. Do not change it for this release.
5. **Owner analytics (optional, already available):** `migration_fs_v1_1_owner_analytics.sql`.
6. **Netlify:** project FactorySearch → branch `main`, build command empty, publish `.`.

## Adding an editor
1. Auth → Add user with their email and password. Share the password privately. Do not do this from the site.
2. `config.js` → add the email to `ALLOWED_EMAILS`.
3. SQL Editor: replace `fs_allowed()` with the same email added to the array.
4. Commit and push.

## Analytics
`fs_events` logs signed-in session_start, session_ping, supplier_open, source_click, and worksheet_open/save. There is no anonymous telemetry. Query in the SQL Editor, for example
`select user_email, event_type, count(*) from fs_events group by 1, 2;`

## Tests
`node tests/rebalance.test.js`

`node tests/auth_url.test.js`

`node tests/security.test.js` (includes live anon read/write denial against the publishable key)

`NODE_PATH=/tmp/fstest/node_modules node tests/dom.test.js`

`node tests/worksheet.test.js`

`NODE_PATH=/tmp/fstest/node_modules node tests/worksheet_dom.test.js`

## Password setup
Recovery links still open **Set your password**. Add `https://factorysearch.netlify.app/**` to Redirect URLs, then generate a recovery link with redirect `https://factorysearch.netlify.app/?setup=1`. The site clears the token from the URL.

## Releases
Bump VERSION in `config.js` and the matching `?v=` on every asset in `index.html` (`tests/dom.test.js` checks they match).
