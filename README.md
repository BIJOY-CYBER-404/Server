# License System — Vercel + Supabase version

Same license system (free trial, one per device, paid key activation,
expiry, admin panel with bulk actions/HWID reset/trial blocking,
maintenance kill switch) rebuilt for serverless hosting: **Next.js on
Vercel** + **Supabase (Postgres)** instead of PHP + MySQL.

The API contract (endpoint paths, request/response JSON) is identical to
the PHP version, so `client/license_client.py` is unchanged — point
`API_BASE_URL` at your Vercel deployment and it works exactly the same.

## Folder layout

```
license-system-vercel/
├── supabase/schema.sql       # Run once in the Supabase SQL Editor
├── package.json
├── .env.example               # Copy to .env.local for local dev
├── lib/
│   ├── supabaseAdmin.js       # Server-only Supabase client (service_role key)
│   ├── apiAuth.js             # X-Api-Secret check for client-facing endpoints
│   ├── adminAuth.js           # Signed admin session cookie (sign/verify)
│   ├── requireAdminSSR.js     # getServerSideProps auth guard for admin pages
│   ├── licenseKey.js          # License key generator
│   └── licenseHelpers.js      # sync_expired_licenses + time-left formatting
├── pages/
│   ├── api/
│   │   ├── status.js, check.js, trial.js, activate.js   # client-facing (Python tool calls these)
│   │   └── admin/
│   │       ├── login.js, logout.js, create-admin.js
│   │       ├── settings.js                # dashboard counts + toggles
│   │       ├── trials.js                  # list/block/unblock
│   │       └── licenses/
│   │           ├── index.js               # list + generate
│   │           ├── bulk.js                # bulk delete / bulk force-paid
│   │           └── [id]/action.js         # per-row action
│   ├── login.js, create-admin.js
│   ├── dashboard.js, licenses.js, trials.js
│   └── _app.js, _document.js, index.js
├── components/                # Layout, ThemeToggle, CopyChip
├── styles/globals.css         # Same design system as the PHP version
└── client/license_client.py   # Same file as the PHP version, unchanged
```

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it.
3. Go to **Project Settings → API** and note down:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not the `anon` key — this one bypasses Row Level
     Security, which is what our API routes rely on) → `SUPABASE_SERVICE_ROLE_KEY`

The service_role key is powerful — never put it in client-side code or a
`NEXT_PUBLIC_*` env var. It's only ever read inside `pages/api/*` and
`getServerSideProps`, both of which run exclusively on the server.

## 2. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New Project** → import that repo. Vercel auto-detects Next.js, no config needed.
3. Before the first deploy (or in **Project Settings → Environment
   Variables** any time after), set:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `API_SECRET` | a long random string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ADMIN_SESSION_SECRET` | a **different** long random string, same command |
   | `ADMIN_SETUP_TOKEN` | any string you'll type in once, to gate first-admin creation |
   | `TRIAL_DAYS` | `2` (or whatever you want) |

4. Deploy.

## 3. Create your first admin

Visit `https://your-app.vercel.app/create-admin`, enter the
`ADMIN_SETUP_TOKEN` you set above plus a username/password. This endpoint
also refuses to run at all once any admin already exists, so it's safe to
leave deployed — but you can still remove/rotate `ADMIN_SETUP_TOKEN` in
Vercel afterward if you'd rather close that door too.

Log in at `/login`.

## 4. Wire up your Python/Termux tool

Same `client/license_client.py` as the PHP version. Just set:

```python
API_BASE_URL = "https://your-app.vercel.app/api"
API_SECRET = "the same string you set in Vercel"
```

## Differences from the PHP version worth knowing

- **Admin auth is a signed cookie, not a PHP session.** Serverless
  functions don't share memory between invocations, so there's no
  server-side session store — `adminAuth.js` signs `{id, username}` with
  HMAC-SHA256 (`ADMIN_SESSION_SECRET`) into an httpOnly cookie instead.
  Functionally equivalent, just stateless.
- **No `DELETE THIS FILE after use` step.** The PHP version's
  `create_admin.php` relied on you manually removing the file from the
  server. On Vercel that's awkward (you'd need a redeploy), so
  `/create-admin` is gated by a token + "only works while zero admins
  exist" instead — safe to leave deployed permanently.
- **No connection-pool concerns.** Supabase's JS client talks to
  Postgres over its REST API (PostgREST), not a raw TCP connection — so
  unlike a lot of "Postgres from serverless" setups, you don't need
  pgbouncer or a pooler to avoid exhausting connections across many
  concurrent function invocations.
- **RLS enabled with zero policies** on every table (see `schema.sql`).
  The app never uses the `anon` key anywhere, so this is a pure safety
  net — if the `anon` key ever ended up somewhere it shouldn't (e.g.
  accidentally shipped to the browser), it still couldn't read or write
  anything.
- **Search escaping**: `.ilike` filters strip `%` and `,` from the search
  term before building the `or(...)` filter string, since Supabase's
  PostgREST filter syntax uses commas as separators and `%` as the
  wildcard — unescaped input could otherwise be used to inject an
  unintended filter clause.

Everything else — one trial per HWID (enforced by the same unique
constraint + claim-before-issue pattern, now on `trial_devices.hwid` in
Postgres), expired-status auto-sync, bulk actions, tap-to-copy, dark/light
theme, Time Left column — works identically to the PHP + MySQL version.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

Runs at `http://localhost:3000`. Note `ADMIN_SESSION_SECRET`-signed
cookies won't get the `Secure` flag in local dev (only in
`NODE_ENV=production`), so login works over plain `http://localhost`.
