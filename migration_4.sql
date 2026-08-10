-- Run this ONCE against your existing database for this update.
-- No schema change is needed — this is a documentation-only migration.

USE license_system;

-- What changed: config.php now pins PHP's default timezone to UTC
-- (date_default_timezone_set('UTC')), and admin/actions.php's "+30 days"
-- action and config.php's sync_expired_licenses() no longer use MySQL's
-- NOW()/DATE_ADD(NOW()...) — they now use PHP-computed UTC timestamps
-- instead, passed in as query parameters. The Python client also switched
-- from datetime.now() to datetime.utcnow() in calculate_time_left().
--
-- Why: expires_at is written by PHP and read back by the Python client on
-- the phone. If PHP's clock, MySQL's clock, and the phone's local clock
-- aren't all on the same timezone, the countdown shown on the client can
-- be off by however many hours separate them (e.g. a fresh 2-day key
-- showing "1d 18h left" on a UTC+6 device if the server was writing UTC
-- and the client was comparing against local time).
--
-- Caveat for existing data: any expires_at values already stored before
-- this update were computed using whatever timezone your PHP host's
-- php.ini happened to default to — which may or may not have been UTC.
-- There's no way to know that after the fact, so those existing rows might
-- carry a fixed offset of a few hours from what they were meant to be.
-- Going forward, every new key, every extension, and every set_expiry
-- edit will be correctly anchored to UTC. If precision matters for a
-- specific existing key, the simplest fix is to re-set its expiry once via
-- Licenses → that row's menu → "Set expiry" (or "+30 days" / "Lifetime")
-- — any of those actions will overwrite it with a correctly-computed UTC
-- value.
