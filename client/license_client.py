"""
license_client.py
------------------
Drop-in license/HWID check for your own Termux/Android Python tool.
Talks to your self-hosted PHP + MySQL license API (see ../api and
../schema.sql) instead of a public Firebase database.

Usage in your main script:

    from license_client import check_license, calculate_time_left

    result = check_license()
    if not result:
        sys.exit()
    user_name, user_key, expiry = result
    print(f"Welcome {user_name} — {calculate_time_left(expiry)}")
"""

import os
import sys
import time
import random
import string
from datetime import datetime

import requests

# --- Configure these for your deployment ---
API_BASE_URL = "https://yourdomain.com/api"      # no trailing slash
API_SECRET = "CHANGE_THIS_TO_MATCH_config.php"   # must match config.php API_SECRET
APP_VERSION = "1.0"
# --------------------------------------------

SAVED_KEY_FILES = [
    "/sdcard/.mytool_device.id",
    os.path.expanduser("~/.mytool_key.txt"),
]

HWID_FALLBACK_FILES = [
    "/sdcard/.mytool_hwid_fallback",
    os.path.expanduser("~/.mytool_hwid_fallback"),
]

HEADERS = {"X-Api-Secret": API_SECRET, "Content-Type": "application/json"}

# Substrings that show up in shell error output rather than real prop values
# (e.g. "cmd: Failure calling service settings: Failed transaction ...").
# Any prop containing one of these is treated as unavailable, not as data.
_ERROR_MARKERS = (
    "cmd:", "failure", "exception", "error:", "no such", "not found",
    "permission denied", "denied", "traceback",
)


def _run(cmd):
    try:
        return os.popen(cmd + " 2>/dev/null").read()
    except Exception:
        return ""


def _clean_prop(value):
    """Returns value stripped, or '' if it looks like an error/empty/placeholder."""
    value = (value or "").strip()
    if not value:
        return ""
    low = value.lower()
    if any(marker in low for marker in _ERROR_MARKERS):
        return ""
    if low in ("null", "unknown", "0", "none"):
        return ""
    return value


def _api_post(path, payload, timeout=10):
    try:
        res = requests.post(f"{API_BASE_URL}/{path}", json=payload, headers=HEADERS, timeout=timeout)
        return res.json()
    except Exception:
        return None


def _api_get(path, timeout=10):
    try:
        res = requests.get(f"{API_BASE_URL}/{path}", headers=HEADERS, timeout=timeout)
        return res.json()
    except Exception:
        return None


def get_device_model():
    brand = _clean_prop(_run("getprop ro.product.brand")).capitalize()
    model = _clean_prop(_run("getprop ro.product.model"))
    if brand and model:
        return model if brand.lower() in model.lower() else f"{brand} {model}"
    return model or brand or "Unknown Device"


def get_android_version():
    return _clean_prop(_run("getprop ro.build.version.release")) or "Unknown"


def _read_fallback_hwid():
    for path in HWID_FALLBACK_FILES:
        if os.path.exists(path):
            try:
                with open(path) as f:
                    val = f.read().strip()
                    if val:
                        return val
            except Exception:
                pass
    return None


def _save_fallback_hwid(value):
    for path in HWID_FALLBACK_FILES:
        try:
            with open(path, "w") as f:
                f.write(value)
        except Exception:
            pass


def get_hwid():
    """
    Builds a stable per-device ID from several hardware signals, each
    validated so a failed shell command (e.g. "cmd: Failure calling service
    settings: Failed transaction (2147483646)") never gets baked into the ID
    as if it were real data — that would make every device hitting the same
    permission restriction collide on one identical, broken HWID.

    Falls back to a locally persisted random ID only if every OS-level
    signal is unavailable, and reuses that same persisted ID on every future
    run (instead of regenerating it), so cached-key lookups keep matching.
    """
    android_id = _clean_prop(_run("settings get secure android_id"))
    serial = _clean_prop(_run("getprop ro.serialno"))
    board = _clean_prop(_run("getprop ro.board.platform"))
    device = _clean_prop(_run("getprop ro.product.device"))
    brand = _clean_prop(_run("getprop ro.product.brand"))
    model = _clean_prop(_run("getprop ro.product.model"))

    parts = [p for p in (android_id, serial, board, device) if p]
    if len(parts) >= 2:
        # At least two independent signals agree the device is identifiable.
        return "_".join(parts)

    if (brand or model) and (android_id or serial):
        # One strong signal (android_id/serial) plus model info is still
        # reasonably unique — better than falling all the way back.
        combo = "_".join(p for p in (brand, model, android_id or serial) if p)
        return combo

    # Nothing trustworthy came back from the OS at all. Reuse a persisted
    # random ID instead of generating a fresh one every run.
    existing = _read_fallback_hwid()
    if existing:
        return existing

    new_id = "DEVICE_" + "".join(random.choices(string.ascii_uppercase + string.digits, k=12))
    _save_fallback_hwid(new_id)
    return new_id


def calculate_time_left(expiry_str):
    """
    expires_at is stored by the server in UTC (config.php pins PHP's default
    timezone to UTC). Comparing it against datetime.now() — the phone's
    local time — silently shifts the result by the device's UTC offset
    (e.g. a fresh 2-day key would show as "1d 18h left" on a UTC+6 phone).
    datetime.utcnow() keeps both sides on the same clock regardless of the
    device's timezone setting.
    """
    if not expiry_str:
        return "Lifetime Access"
    try:
        fmt = "%Y-%m-%d %H:%M:%S" if len(expiry_str) > 10 else "%Y-%m-%d"
        exp_dt = datetime.strptime(expiry_str, fmt)
        diff = (exp_dt - datetime.utcnow()).total_seconds()
        if diff <= 0:
            return "Expired"
        hours = int(diff // 3600)
        minutes = int((diff % 3600) // 60)
        if hours < 24:
            return f"{hours}h {minutes}m left"
        days, rem_hours = divmod(hours, 24)
        return f"{days}d {rem_hours}h {minutes}m left"
    except Exception:
        return expiry_str


def _read_saved_key():
    for path in SAVED_KEY_FILES:
        if os.path.exists(path):
            try:
                with open(path) as f:
                    val = f.read().strip().upper()
                    if val:
                        return val
            except Exception:
                pass
    return None


def _save_key(key):
    for path in SAVED_KEY_FILES:
        try:
            with open(path, "w") as f:
                f.write(key)
        except Exception:
            pass


def _clear_saved_keys():
    for path in SAVED_KEY_FILES:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass


def check_license():
    """
    Full flow: maintenance check -> local cache -> HWID lookup -> trial issue
    -> prompt for paid key. Returns (name, key, expiry) or None.
    """
    status = _api_get("status.php")
    if status and status.get("maintenance"):
        print("\n[!] System is under maintenance. Please try again later.\n")
        sys.exit()

    hwid = get_hwid()
    saved_key = _read_saved_key()

    # 1. Try the cached key
    if saved_key:
        result = _api_post("check.php", {"hwid": hwid, "key": saved_key})
        if result and result.get("ok") and result.get("valid"):
            return result.get("name", "USER"), result.get("key", saved_key), result.get("expires_at")
        _clear_saved_keys()

    # 2. HWID-only lookup (covers reinstalls where the local file was wiped)
    result = _api_post("check.php", {"hwid": hwid, "key": ""})
    if result and result.get("ok") and result.get("valid"):
        _save_key(result["key"])
        return result.get("name", "USER"), result["key"], result.get("expires_at")

    # 3. First-time device -> try auto trial
    device_model = get_device_model()
    android_version = get_android_version()
    trial = _api_post("trial.php", {
        "hwid": hwid,
        "device_model": device_model,
        "android_version": android_version,
        "app_version": APP_VERSION,
    })
    if trial and trial.get("ok") and trial.get("granted"):
        _save_key(trial["key"])
        print("\n[✓] 2-day free trial activated for this device!\n")
        time.sleep(1)
        return "FREE TRIAL USER", trial["key"], trial.get("expires_at")

    reason_messages = {
        "trial_disabled": "[!] Free trials are currently turned off.",
        "trial_already_used": "[!] This device has already used its free trial.",
        "trial_blocked": "[!] This device is not eligible for a free trial.",
        "device_already_licensed": "[!] This device already has a license on file.",
    }
    reason = (trial or {}).get("reason", "")
    print("\n" + reason_messages.get(reason, "[!] Free trial unavailable.") + " Please enter a license key.\n")
    name = input("Enter your name: ").strip().upper() or "USER"
    key = input("Enter your license key: ").strip().upper()

    activation = _api_post("activate.php", {
        "key": key,
        "hwid": hwid,
        "name": name,
        "device_model": device_model,
        "android_version": android_version,
        "app_version": APP_VERSION,
    })

    if activation and activation.get("ok") and activation.get("valid"):
        _save_key(activation["key"])
        return name, activation["key"], activation.get("expires_at")

    reason = (activation or {}).get("error", "unknown_error")
    print(f"\n[×] License activation failed: {reason}\n")
    sys.exit()


if __name__ == "__main__":
    result = check_license()
    if result:
        user_name, user_key, expiry = result
        print(f"Welcome, {user_name}! Key: {user_key} | {calculate_time_left(expiry)}")
