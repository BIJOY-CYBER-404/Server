-- License System - MySQL Schema
-- Import this once via phpMyAdmin / mysql CLI on your hosting account.

CREATE DATABASE IF NOT EXISTS license_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE license_system;

CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_key VARCHAR(64) UNIQUE NOT NULL,
    customer_name VARCHAR(100) DEFAULT NULL,
    hwid VARCHAR(255) DEFAULT NULL,
    device_model VARCHAR(150) DEFAULT NULL,
    android_version VARCHAR(50) DEFAULT NULL,
    app_version VARCHAR(50) DEFAULT NULL,
    is_trial TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME DEFAULT NULL,          -- NULL = lifetime
    status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hwid (hwid)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trial_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hwid VARCHAR(255) UNIQUE NOT NULL,
    note VARCHAR(255) DEFAULT NULL,           -- e.g. "Blocked by admin" vs an actual trial grant
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255)
) ENGINE=InnoDB;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
    ('maintenance_mode', '0'),
    ('current_version', '1.0'),
    ('trial_enabled', '1');
