# Self-Hosted License System (PHP + MySQL)

A device-locked license system for your own tool: free trial (one per device),
paid key activation, expiry, admin panel with HWID reset, and a
maintenance-mode kill switch. Replaces a public/unauthenticated Firebase
backend with your own MySQL database behind a shared-secret API.

## Folder layout

```
license-system/
├── schema.sql              # Import this into MySQL once
├── config.php              # DB credentials + API secret (edit this first)
├── api/                    # Endpoints your Python client calls
│   ├── status.php
│   ├── check.php
│   ├── trial.php
│   └── activate.php
├── admin/                  # Browser-based admin panel
│   ├── create_admin.php    # Run once, then delete
│   ├── login.php / logout.php
│   ├── dashboard.php
│   ├── keys.php
│   ├── trials.php
│   ├── actions.php
│   ├── bulk_actions.php
│   ├── settings.php
│   ├── includes/           # header.php + footer.php (shared layout), auth.php
│   └── assets/             # style.css, app.js (tap-to-copy, dropdown menus)
└── client/
    └── license_client.py   # Drop into your Termux/Python tool
```

## 1. Deploy to shared hosting

1. Create a MySQL database and user in your hosting control panel.
2. Import `schema.sql` (phpMyAdmin → Import, or `mysql -u user -p dbname < schema.sql`).
3. Upload the `api/`, `admin/`, and `config.php` files to your web root
   (e.g. `public_html/license/`). Keep `config.php` one level above
   `public_html` if your host supports it — otherwise it's fine in place,
   PHP source isn't served as plain text by a normal Apache/Nginx setup.
4. Edit `config.php`:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` — your database credentials.
   - `API_SECRET` — generate a long random string, e.g. run locally:
     `php -r "echo bin2hex(random_bytes(32));"`
     (or in Python: `python3 -c "import secrets; print(secrets.token_hex(32))"`)
5. Visit `https://yourdomain.com/license/admin/create_admin.php`, create your
   admin username/password, then **delete `create_admin.php` immediately**.
6. Log in at `https://yourdomain.com/license/admin/login.php`.

Make sure the whole thing is served over **HTTPS** — the API secret and
license keys travel in request bodies/headers, and plain HTTP would expose
them to anyone on the network path.

## 2. Wire up your Python/Termux tool

Copy `client/license_client.py` next to your main script, then at the top
of your tool:

```python
from license_client import check_license, calculate_time_left
import sys

result = check_license()
if not result:
    sys.exit()
user_name, user_key, expiry = result
print(f"Welcome {user_name} — {calculate_time_left(expiry)}")

# ... rest of your tool's logic ...
```

Edit the two constants at the top of `license_client.py`:

```python
API_BASE_URL = "https://yourdomain.com/license/api"
API_SECRET = "the same string you put in config.php"
```

## 3. Day-to-day use (admin panel)

The admin panel UI is in English, with a dark/light theme toggle (the
sun/moon icon in the top bar — your choice is remembered on that browser).

- **Generate a key**: Licenses page → "Generate new license key" → set a
  customer name and validity in days (blank = lifetime).
- **Copy a key**: tap/click the key anywhere it's shown (a green outline and
  "Copied!" tooltip confirm it) — copies straight to clipboard.
- **Give it to the customer**: they enter it once in your tool; the API
  binds it to that device's HWID automatically.
- **Filter the list**: tabs at the top of the Licenses page (All / Active /
  Trial / Expired / Revoked) plus a search box for key, name, or HWID.
- **Per-key actions**: click the **⋮** menu on any row for reset HWID,
  revoke/reactivate, extend/set-expiry/lifetime, and delete.
- **Bulk actions**: tick the checkbox on any rows (or the header checkbox
  to select everything visible), then use the bar above the table —
  **End Trial (Force Paid)** revokes every selected license and locks each
  one's HWID out of future auto-trials, same as the single-row version but
  for many at once; **Delete Selected** removes them permanently. Both ask
  for confirmation first. Selection respects whatever filter/search you
  currently have applied.
- **See how much time is left**: the Licenses page has a **Time Left**
  column next to Expires — a live countdown ("2d 4h left") computed in
  UTC, matching what the client itself will show. Amber = expiring within
  24 hours, red = already expired.
- **Customer gets a new phone**: **⋮ → Reset HWID** so the key can bind to
  the new device.
- **Stop paying customer**: **⋮ → Revoke**. `check.php` will reject them on
  their next check even though the key still exists (for your records).
- **End a trial early and force a paid key**: on any active trial row,
  **⋮ → "End trial, require paid key"**. This revokes the trial
  immediately *and* explicitly records the HWID as trial-used, so that
  device can never auto-get another trial — the client will send it
  straight to "enter a license key" on its very next check.
- **Extend**: **+30 days** adds 30 days to the current expiry (or from now,
  if already expired). Or use **Set** with a date picker for an exact
  expiry, or **∞ Lifetime** to make a key never expire.
- **Emergency stop for everyone**: Dashboard → toggle "Maintenance mode" —
  every client sees the maintenance message on next launch, without you
  touching any keys.
- **Turn off auto-trials globally**: Dashboard → toggle off "Allow new
  devices to auto-get a free trial". New devices then skip straight to
  "enter a license key"; devices that already have a trial key keep using
  it until it expires.
- **Block a specific device from ever getting a trial**: Trials page →
  "Block a HWID from trials" — useful for a known emulator/reseller
  fingerprint you want to shut out before it ever requests a trial. Remove
  the row later to allow that device to try again.

### One trial per device — how it's actually enforced

This isn't just a UI restriction. `trial_devices.hwid` has a UNIQUE
constraint in the database, and `api/trial.php` claims that row *inside a
transaction*, before ever issuing a key — so even two near-simultaneous
requests from the same device can't both succeed. Once a HWID is in that
table (whether from an actual trial grant, an admin's manual block, or
"End trial, require paid key"), it stays blocked from auto-trials
**forever**, independent of what happens to the license record itself:
- **Trial expires naturally**: `check.php` marks the license `expired`;
  the client then asks `trial.php` for a new one, which is refused because
  the HWID is already in `trial_devices` — the client falls through to
  asking for a paid key.
- **Admin cancels/revokes a trial**: same outcome — `trial_devices` still
  has the row, so no second trial is possible.
- **Admin deletes the trial license row entirely**: still doesn't help —
  `trial_devices` is a separate table and is never touched by deleting a
  license.

The only way to let a specific device try again is removing its row on the
Trials page.

### If you already deployed a previous version

Run `migration_2.sql`, `migration_3.sql`, and `migration_4.sql` once
against your existing database, in that order, then re-upload the `api/`,
`admin/`, `client/`, and `config.php` files. `migration_2.sql` adds the
`note` column used by the Trials page and the `trial_enabled` setting used
by the dashboard toggle. `migration_3.sql` and `migration_4.sql` are
documentation-only — no schema change, but see the notes inside each for
what changed in the code.

### Usage tracking has been removed

There's no more `api/log_usage.php`, no more "Uses Today" card, no more
per-day usage table. If you'd already deployed the earlier version, the
`usage_logs` table in your database is simply unused now — harmless to
leave, or `DROP TABLE usage_logs;` if you want it gone (that deletes
whatever historical counts were in it, so only do this if you don't need
them).

### Expired status now stays accurate without waiting on the client

Previously, a license's `status` column only flipped to `expired` when
*that specific device* checked in after its expiry date — `api/check.php`
is the only place that ever wrote that transition. A device that goes
quiet after expiring (uninstalled, phone off, no signal) never triggers
that check, so the stored status could stay `active` indefinitely even
though `expires_at` was long past — making the Licenses page's Expired
tab, badge, and count all silently wrong.

Fixed by adding `sync_expired_licenses()` in `config.php`, which the
Dashboard and Licenses pages now call on every page load:

```sql
UPDATE licenses SET status = 'expired'
WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?
-- (? is PHP's own current UTC time, not MySQL's NOW() — see below)
```

So the moment you open the admin panel, any license whose `expires_at` has
passed gets flagged `expired` immediately — regardless of whether its
device has phoned home. `api/check.php` still does its own real-time check
too, so a client gets the correct answer even between admin-panel visits.

### Timezone fix: countdown showing fewer hours than it should

If a fresh 2-day key showed as "1d 18h left" (or similar) on the client
shortly after being created, that was a timezone mismatch, not a rounding
error. `expires_at` was being written using whatever timezone PHP's host
defaulted to, while the client compared it against the phone's own local
time — any difference between those two clocks (e.g. UTC vs. UTC+6) showed
up as missing hours.

Fixed by standardizing the whole system on UTC:
- `config.php` now calls `date_default_timezone_set('UTC')`, so every
  `new DateTime()` / `date()` call anywhere in the PHP code is UTC,
  regardless of the host's php.ini default.
- MySQL's `NOW()` was removed from `sync_expired_licenses()` and the
  "+30 days" admin action — MySQL has its *own*, separately configured
  timezone that has nothing to do with PHP's setting, so relying on it
  could reintroduce the exact same kind of mismatch. Both now use a
  PHP-computed UTC timestamp instead.
- The Python client's `calculate_time_left()` now uses
  `datetime.utcnow()` instead of `datetime.now()`, so it's comparing
  against the same UTC clock the server used to write `expires_at`,
  regardless of the phone's own timezone setting.

Existing `expires_at` values written before this fix may carry a small
baked-in offset (see `migration_4.sql` for how to clean up a specific key
if it matters). Everything created or edited from now on is correct.

## Design notes / what changed vs. a Firebase setup

- **Auth on every request**: all API calls require an `X-Api-Secret` header
  matching `config.php`. The original Firebase REST endpoints had no auth at
  all — anyone with the URL could read or write any record.
- **Server-side expiry + status enforcement**: `active` / `revoked` /
  `expired` is checked server-side on every call, not just trusted from a
  locally-cached file.
- **HWID collision handling**: a key already bound to a different HWID is
  rejected before it's ever activated on a second device.
- **Passwords hashed** with PHP's `password_hash()` (bcrypt) for the admin
  panel, not stored in plaintext.
- **HWID generation validates every signal.** On some devices/ROMs,
  `settings get secure android_id` fails with something like
  `cmd: Failure calling service settings: Failed transaction (2147483646)`
  — and that error text is not a valid device ID. `license_client.py` now
  filters out anything that looks like shell error output before using it,
  combines multiple independent signals when available, and only falls
  back to a random ID as a last resort — persisting that fallback locally
  so it stays the same on every run instead of changing (and breaking the
  license binding) each time the tool starts.

## Things worth adding if you scale this up

- Rate limiting per-IP on `api/*.php` (a simple table + count-per-minute
  check) to slow down brute-forcing of key strings.
- HTTPS + HSTS enforced at the webserver level.
- Logging failed activation attempts so you can spot abuse patterns.
- If you want multiple pricing tiers, add a `plan` column to `licenses` and
  branch your tool's feature set on it.
