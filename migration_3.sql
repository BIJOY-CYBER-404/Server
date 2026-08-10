-- Run this ONCE against your existing database for this update.

USE license_system;

-- Optional: usage tracking has been removed from the app entirely (no more
-- api/log_usage.php, no more "Uses Today" / "last 7 days" on the
-- dashboard). This table is now unused. Drop it only if you don't need the
-- historical daily-usage counts it holds — there's no harm in leaving it in
-- place either, it's just dead weight.
-- DROP TABLE IF EXISTS usage_logs;

-- No schema change needed for the expired-status fix — it's handled by a
-- sync query the admin panel now runs on page load (see config.php,
-- sync_expired_licenses()). Nothing to migrate for that part.
