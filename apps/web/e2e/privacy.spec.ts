/** Native privacy/support journeys with isolated email and no real identity provider calls. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, localRoleHeaders } from './fixtures';
test.use({ actionTimeout: 15000, navigationTimeout: 30000 });
const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
test('native signup, private support, guardian fail-closed, owner export and deletion work end to end', async ({
  browser,
  request,
  extraHTTPHeaders,
}) => {
  test.setTimeout(240000);
  const context = await browser.newContext({
      baseURL: 'http://localhost:5173',
      javaScriptEnabled: false,
      extraHTTPHeaders,
    }),
    page = await context.newPage();
  const tag = Date.now().toString(36),
    email = `privacy_${tag}@skillverse.test`,
    password = 'privacy-learning-fixture-2026';
  await page.goto('/signup');
  await page.getByLabel('Display name or alias', { exact: true }).fill('Private Browser Learner');
  await page.getByLabel('Username', { exact: true }).fill(`privacy_${tag}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Private date of birth', { exact: true }).fill('1990-01-01');
  await page.getByRole('checkbox', { name: /I agree to the Terms/ }).check();
  await page.getByRole('checkbox', { name: /I have read and accept/ }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/check-email/);
  const mail = (await (await request.get('/api/v1/dev/mailbox')).json()).data.find(
      (m: { to: string }) => m.to === email,
    ),
    token = mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  expect(token).toBeTruthy();
  expect(
    (await context.request.post('/api/v1/auth/verify-email', { headers, data: { token } })).ok(),
  ).toBe(true);
  await page.goto('/settings/privacy');
  await expect(
    page.getByText('Your private birth date: 1990-01-01.', { exact: false }),
  ).toBeVisible();
  await page.goto('/contact');
  await page.getByLabel('Subject', { exact: true }).fill(`Private browser request ${tag}`);
  await page
    .getByLabel('Private message', { exact: true })
    .fill('Please explain how I can correct my account information privately.');
  await page.getByRole('checkbox', { name: /I have read the Privacy Notice/ }).check();
  await page.getByRole('button', { name: 'Send private request', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `Private browser request ${tag} · open`, exact: true }),
  ).toBeVisible();
  const staffContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      extraHTTPHeaders: localRoleHeaders(extraHTTPHeaders, 1),
    }),
    staff = await staffContext.newPage();
  await staff.goto('/login');
  await staff.getByLabel('Email', { exact: true }).fill('admin@skillverse.test');
  await staff.getByLabel('Password', { exact: true }).fill('learn-and-grow-2026');
  await staff.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(staff).toHaveURL(/\/dashboard$/);
  await staff.goto('/admin/support');
  const ticket = staff.locator('section.surface-panel').filter({
    has: staff.getByRole('heading', {
      name: new RegExp(`^Private browser request ${tag}`),
    }),
  });
  await ticket
    .getByLabel(`Private reply to ${email}`)
    .fill(
      'Your request is private. Please use the verified account correction process before changing your date of birth.',
    );
  await ticket.getByRole('checkbox', { name: 'Resolve after this reply' }).check();
  await ticket.getByRole('button', { name: 'Save and send reply', exact: true }).click();
  await expect(ticket.getByText('Delivery: delivered · attempts 1', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(
      'Your request is private. Please use the verified account correction process before changing your date of birth.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto('/settings/guardians');
  await page.getByRole('checkbox', { name: /I consent to the selected child account/ }).check();
  await page.getByRole('button', { name: 'Create verification request', exact: true }).click();
  const permission = page
    .locator('section.surface-panel')
    .filter({ has: page.getByRole('heading', { name: 'learning · pending', exact: true }) });
  await permission
    .locator(':scope > form')
    .getByLabel('Current password', { exact: true })
    .fill(password);
  await permission.getByRole('checkbox', { name: /I consent to Setu DigiLocker/ }).check();
  await permission.getByRole('checkbox', { name: /I am a parent or legal guardian/ }).check();
  await permission.getByRole('button', { name: 'Verify with DigiLocker', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not configured');
  await page.goto('/settings/teacher-verification');
  await page.getByRole('checkbox', { name: /I accept the Instructor Terms/ }).check();
  await page.getByRole('button', { name: 'Accept Instructor Terms', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Verify teacher identity with DigiLocker', exact: true }),
  ).toBeVisible();
  await page.goto('/settings/privacy');
  const exportSection = page
    .locator('section.surface-panel')
    .filter({ has: page.getByRole('heading', { name: 'Download your data', exact: true }) });
  await exportSection.getByLabel('Current password', { exact: true }).fill(password);
  await exportSection.getByRole('button', { name: 'Request export', exact: true }).click();
  // Native pages refresh using the same owner-only status API; no JavaScript requirement for rights.
  let exportId = '';
  await expect
    .poll(
      async () => {
        const response = await context.request.get('/api/v1/me/privacy/exports');
        expect(response.ok()).toBe(true);
        const jobs = (await response.json()).data;
        exportId = jobs[0]?.id ?? '';
        return jobs[0]?.state;
      },
      { timeout: 30000 },
    )
    .toBe('ready');
  const download = await context.request.get(`/settings/export/${exportId}`);
  expect(download.ok()).toBe(true);
  const copy = await download.text();
  expect(copy).toContain(email);
  expect(copy).not.toContain('password_hash');
  expect(
    (await staffContext.request.get(`/api/v1/me/privacy/exports/${exportId}/download`)).status(),
  ).toBe(404);
  await page.goto('/settings/privacy');
  // Axe injects JavaScript, so audit a separate hydrated view of the same owner session.
  // The rights journey itself remains in the original JavaScript-disabled browser.
  const auditContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
    storageState: await context.storageState(),
  });
  const auditPage = await auditContext.newPage();
  await auditPage.goto('/settings/privacy');
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await auditPage.setViewportSize({ width, height: 900 });
    expect(
      (
        await new AxeBuilder({ page: auditPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await auditPage.screenshot({ path: 'test-results/privacy-desktop.png', fullPage: true });
  await auditContext.close();
  const deletion = page
    .locator('section.surface-panel')
    .filter({ has: page.getByRole('heading', { name: 'Delete this account', exact: true }) });
  await deletion.getByLabel('Current password', { exact: true }).fill(password);
  await deletion.getByLabel('Type DELETE to confirm').fill('DELETE');
  await deletion.getByRole('button', { name: 'Delete account permanently', exact: true }).click();
  await expect(page).toHaveURL(/\/?account=deleted$/);
  expect((await context.request.get('/api/v1/me')).status()).toBe(401);
  await context.close();
  await staffContext.close();
});
test('guest Contact confirmation is scanner-safe and public policies are reachable', async ({
  page,
  request,
}) => {
  const tag = Date.now().toString(36),
    email = `guest_${tag}@skillverse.test`;
  await page.goto('/contact');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Subject', { exact: true }).fill('Guest privacy question');
  await page
    .getByLabel('Private message', { exact: true })
    .fill('Please explain the guardian consent process before a child account is created.');
  await page.getByRole('checkbox', { name: /I have read the Privacy Notice/ }).check();
  await page.getByRole('checkbox', { name: /I am 18 or older/ }).check();
  await page.getByRole('button', { name: 'Send private request', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Request received');
  let token: string | undefined;
  await expect
    .poll(async () => {
      const mail = (await (await request.get('/api/v1/dev/mailbox')).json()).data.find(
        (m: { to: string }) => m.to === email,
      );
      token = mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
      return Boolean(token);
    })
    .toBe(true);
  await page.goto(`/contact/confirm?token=${token}`);
  await page.reload();
  await page.getByRole('button', { name: 'Confirm Contact request', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('confirmed');
  for (const path of [
    'terms',
    'privacy',
    'cookies',
    'community-guidelines',
    'instructor-terms',
    'refunds',
  ]) {
    await page.goto(`/${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
