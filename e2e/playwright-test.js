import { chromium } from 'playwright';

const FRONTEND = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:3001/api';

async function createUser(email, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'E2E Test' })
  });
  return res.json();
}

async function run() {
  const email = `e2e+${Date.now()}@example.com`;
  const password = 'TestPass@123';

  console.log('Creating test user via API...');
  const reg = await createUser(email, password);
  const { accessToken, refreshToken, user } = reg;

  console.log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Inject tokens into localStorage before page load
  await context.addInitScript(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('brokar_user', JSON.stringify(user));
  }, { accessToken, refreshToken, user });

  const page = await context.newPage();
  console.log('Opening frontend...');
  await page.goto(FRONTEND, { waitUntil: 'networkidle' });

  // Navigate to the profile section using the header nav.
  await page.waitForSelector('nav button', { state: 'visible', timeout: 5000 });
  const profileNavButton = page.locator('nav button').nth(1);
  await profileNavButton.click();
  console.log('Opened profile view');

  // Open the Settings tab if not already active.
  const settingsTab = page.locator('button:has-text("Settings")').first();
  await settingsTab.click();
  console.log('Opened Settings tab');

  await page.waitForSelector('div:has-text("Email Notifications")', { state: 'visible', timeout: 5000 });
  const notificationCard = page.locator('div:has-text("Email Notifications")').first();
  if (await notificationCard.count() === 0) {
    console.error('Email Notifications card not found');
  } else {
    const toggle = notificationCard.locator('label').first();
    if (await toggle.count() === 0) {
      console.error('Settings toggle label not found inside notification card');
    } else {
      await toggle.click();
      console.log('Clicked Email Notifications toggle');

      const switchTrack = toggle.locator('div.w-9.h-5').first();
      await switchTrack.waitFor({ state: 'visible', timeout: 5000 });
      const active = await switchTrack.evaluate((el) => el.className.includes('bg-red-600'));
      console.log(`Toggle state after click: ${active ? 'on' : 'off'}`);
    }
  }

  await page.reload({ waitUntil: 'networkidle' });
  console.log('Reloaded page to verify persistence');

  // Verify persistence via API
  try {
    const settingsRes = await fetch(`${API}/users/me/settings`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const settings = await settingsRes.json();
    console.log('Backend settings after toggle:', settings);
  } catch (e) {
    console.warn('Failed to fetch settings via API for verification', e);
  }

  await browser.close();
  console.log('Headless UI test completed');
}

run().catch(e => { console.error(e); process.exit(1); });
