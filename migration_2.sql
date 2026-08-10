-- Run this ONCE if you already imported the original schema.sql.
-- Safe to run even if some parts already exist (uses IF NOT EXISTS / IGNORE
-- where MySQL supports it; for the column add, ignore an error saying the
-- column already exists — that just means you're up to date on that part).

USE license_system;

ALTER TABLE trial_devices ADD COLUMN note VARCHAR(255) DEFAULT NULL AFTER hwid;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('trial_enabled', '1');
