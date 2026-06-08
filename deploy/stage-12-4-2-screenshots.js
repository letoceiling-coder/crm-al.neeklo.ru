const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://crm-al.neeklo.ru';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots', 'stage-12-4-2');

const pages = [
  { name: '01-system-settings-general', url: '/system/settings/general' },
  { name: '02-payments', url: '/system/settings/payments' },
  { name: '03-smtp-email', url: '/system/settings/email' },
  { name: '04-alerts', url: '/system/settings/alerts' },
  { name: '05-registration', url: '/system/settings/registration' },
  { name: '06-launch-center', url: '/system/launch' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ai-gateway.local', password: 'admin123' }),
  });
  const auth = await loginRes.json();
  if (!auth.accessToken) throw new Error('Login failed');

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem(
        'ai-gateway-auth',
        JSON.stringify({ state: { token, user }, version: 0 }),
      );
    },
    { token: auth.accessToken, user: auth.user },
  );

  for (const p of pages) {
    await page.goto(`${BASE}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
    console.log('saved', p.name);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
