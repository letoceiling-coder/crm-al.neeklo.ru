#!/usr/bin/env python3
"""Capture Stage 12.4.2 production screenshots (run on server or machine with playwright)."""
import json
import os
import urllib.request

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright not installed")
    raise

BASE = "https://crm-al.neeklo.ru"
OUT = "/tmp/stage-12-4-2-screenshots"
PAGES = [
    ("01-system-settings-general", "/system/settings/general"),
    ("02-payments", "/system/settings/payments"),
    ("03-smtp-email", "/system/settings/email"),
    ("04-alerts", "/system/settings/alerts"),
    ("05-registration", "/system/settings/registration"),
    ("06-launch-center", "/system/launch"),
]

req = urllib.request.Request(
    BASE + "/api/auth/login",
    data=json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as r:
    auth = json.loads(r.read().decode())

os.makedirs(OUT, exist_ok=True)
storage = json.dumps({"state": {"token": auth["accessToken"], "user": auth["user"]}, "version": 0})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE, wait_until="domcontentloaded")
    page.evaluate("(s) => localStorage.setItem('ai-gateway-auth', s)", storage)
    for name, path in PAGES:
        page.goto(BASE + path, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
        print("saved", name)
    browser.close()

print("OUT=" + OUT)
