/** Real account decisions, revoked learner sessions, native forms and responsive staff operations. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures';
import { adultConsent } from './fixtures';

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
const password = 'learn-and-grow-2026';
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('admin searches, suspends, reactivates and revokes learner access with an audit history', async ({
  browser,
  extraHTTPHeaders,
  page,
  request,
}) => {
  test.setTimeout(180_000);
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const tag = Date.now().toString(36),
    user = {
      email: `adminflow_${tag}@skillverse.test`,
      username: `adminflow_${tag}`,
      displayName: `Account Learner ${tag}`,
      password,
    };
  expect(
    (
      await request.post('/api/v1/auth/register', { headers, data: { ...adultConsent, ...user } })
    ).ok(),
  ).toBe(true);
  const mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
  const token = mailbox.data
    .find((mail: { to: string }) => mail.to === user.email)
    ?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  expect(token).toBeTruthy();
  expect((await request.post('/api/v1/auth/verify-email', { headers, data: { token } })).ok()).toBe(
    true,
  );
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        headers,
        data: { completeOnboarding: true, interests: ['programming'], goal: 'upskill' },
      })
    ).ok(),
  ).toBe(true);
  const id = (await (await request.get('/api/v1/me')).json()).data.id;
  expect(
    (
      await request.post('/api/v1/learning/courses/build-your-first-web-page/enroll', {
        headers,
        data: {},
      })
    ).ok(),
  ).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, user.email);
  const staffContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
  });
  const staff = await staffContext.newPage();
  staff.on('pageerror', (error) => errors.push(error.message));
  try {
    await login(staff, 'admin@skillverse.test');
    await staff.goto('/admin');
    const snapshot = (await (await staff.request.get('/api/v1/admin/overview')).json()).data;
    await expect(
      staff.locator('dl').getByText(String(snapshot.users.active), { exact: true }),
    ).toBeVisible();
    await staff
      .getByRole('navigation', { name: 'Admin sections' })
      .getByRole('link', { name: 'Accounts', exact: true })
      .click();
    await staff.getByLabel('Search accounts', { exact: true }).fill(user.email);
    await staff.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(staff.getByText('1 matching account', { exact: true })).toBeVisible();
    await staff.getByRole('link', { name: user.displayName, exact: true }).click();
    await expect(staff).toHaveURL(new RegExp(`/admin/users/${id}$`));
    await staff.getByRole('button', { name: 'Suspend account', exact: true }).click();
    await expect(
      staff.getByText('Explain the decision in at least 10 characters.', { exact: true }),
    ).toBeVisible();
    await expect(staff.locator('button[aria-haspopup="menu"]')).toBeVisible();
    const reason =
      'Reviewed reported account abuse. <script>window.accountReasonExecuted=true</script>';
    await staff.getByLabel('Decision reason', { exact: true }).fill(reason);
    await staff.getByRole('button', { name: 'Suspend account', exact: true }).click();
    await expect(staff.getByRole('status')).toHaveText(/Account suspended/);
    await expect(
      staff.getByRole('heading', { name: 'Account suspended', exact: true }),
    ).toBeVisible();
    await expect(staff.getByText(reason, { exact: true })).toBeVisible();
    expect(await staff.evaluate(() => 'accountReasonExecuted' in window)).toBe(false);
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
    await page.goto('/learning');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('This account is suspended.');
    await staff
      .getByLabel('Decision reason', { exact: true })
      .fill('Reviewed the evidence again and restored this learner account.');
    await staff.getByRole('button', { name: 'Reactivate account', exact: true }).click();
    await expect(staff.getByRole('status')).toHaveText(/Account reactivated/);
    await login(page, user.email);
    await page.goto('/learning');
    await expect(page.getByRole('heading', { name: 'My learning', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Build your first web page', exact: true }),
    ).toBeVisible();
    await staff.reload();
    await staff
      .getByLabel('Decision reason', { exact: true })
      .fill('Learner reported a lost device; signed out every existing session.');
    await staff.getByRole('button', { name: 'Revoke sessions', exact: true }).click();
    await expect(staff.getByRole('status')).toHaveText(/Sessions revoked/);
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
    await expect(staff.getByRole('heading', { level: 3 })).toHaveText([
      'Sessions revoked',
      'Account reactivated',
      'Account suspended',
    ]);
    for (const theme of ['light', 'dark']) {
      await staffContext.addCookies([
        { name: 'sv_theme', value: theme, domain: 'localhost', path: '/' },
      ]);
      for (const width of [320, 390, 1440]) {
        await staff.setViewportSize({ width, height: 1000 });
        for (const path of ['/admin', `/admin/users?q=${user.email}`, `/admin/users/${id}`]) {
          await staff.goto(path);
          expect(
            await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          const accessibility = await new AxeBuilder({ page: staff })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(accessibility.violations).toEqual([]);
          if (width === 390)
            await staff.screenshot({
              path: `test-results/admin-${path.includes(id) ? 'account' : path.includes('?') ? 'search' : 'overview'}-${theme}.png`,
              fullPage: true,
            });
        }
      }
    }
    await staff.goto(`/admin/users/${id}`);
    await staff.getByLabel('Decision reason', { exact: true }).focus();
    await staff.keyboard.press('Tab');
    await expect(staff.getByRole('button', { name: 'Suspend account', exact: true })).toBeFocused();
    await staff.keyboard.press('Tab');
    await expect(staff.getByRole('button', { name: 'Revoke sessions', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    // Restore only this test-created learner if a journey failed during suspension.
    const response = await staff.request.get(`/api/v1/admin/users/${id}`);
    if (response.ok()) {
      const detail = (await response.json()).data;
      if (detail.user.status === 'suspended')
        await staff.request.post(`/api/v1/admin/users/${id}`, {
          headers,
          data: {
            decision: 'reactivate',
            version: detail.user.version,
            notes: 'Restored the test-created account during local browser cleanup.',
          },
        });
    }
    await staffContext.close();
  }
});

test('account search and protected staff inspection work without JavaScript', async ({
  browser,
  extraHTTPHeaders,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  try {
    await login(page, 'admin@skillverse.test');
    await page.goto('/admin/users');
    await page.getByLabel('Search accounts', { exact: true }).fill('admin@skillverse.test');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('link', { name: 'Demo Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Demo Admin', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suspend account', exact: true })).toHaveCount(0);
    await expect(
      page.getByText(
        'Staff accounts, your own account and deleted accounts are protected from these controls.',
        { exact: false },
      ),
    ).toBeVisible();
    expect((await page.request.get('/api/v1/admin/overview')).ok()).toBe(true);
    await page.screenshot({ path: 'test-results/admin-native-account.png', fullPage: true });
  } finally {
    await context.close();
  }
});
