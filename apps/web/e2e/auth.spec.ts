/** Email sign-in is scanner-safe, carries the learning destination and cannot be replayed. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
test('a learner signs in from an email link without consuming it on GET', async ({
  page,
  request,
}) => {
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const tag = Date.now().toString(36);
  const user = {
    email: `email_${tag}@skillverse.test`,
    username: `email_${tag}`,
    displayName: 'Email Learner',
    password: 'learn-and-grow-2026',
  };
  expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
  let mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
  const verify = mailbox.data
    .find((m: { to: string }) => m.to === user.email)
    ?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  expect(
    (await request.post('/api/v1/auth/verify-email', { headers, data: { token: verify } })).ok(),
  ).toBe(true);
  expect(
    (
      await request.patch('/api/v1/me/profile', { headers, data: { completeOnboarding: true } })
    ).ok(),
  ).toBe(true);
  await request.post('/api/v1/auth/logout', { headers, data: {} });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login?redirectTo=%2Fcourses%2Fbuild-your-first-web-page');
  await page.getByRole('link', { name: 'Sign in with an email link' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in by email', exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox', exact: true })).toBeVisible();
  mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
  const mail = mailbox.data.find((m: { to: string }) => m.to === user.email);
  const url = mail?.text.match(/http:\/\/localhost:5173\/login\/email\/confirm\?\S+/)?.[0];
  expect(url).toBeTruthy();
  await page.goto(url);
  await page.reload(); // A link scanner/repeated GET must not consume the token or create a session.
  expect((await page.context().request.get('/api/v1/me')).status()).toBe(401);
  await expect(page.getByRole('button', { name: 'Continue to SkillVerse' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: 'test-results/email-sign-in-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue to SkillVerse' }).click();
  await expect(page).toHaveURL(/\/courses\/build-your-first-web-page$/);
  await expect(page.getByRole('button', { name: 'Enroll for free' })).toBeVisible();
  await page.goto(url);
  await page.getByRole('button', { name: 'Continue to SkillVerse' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');
  expect(errors).toEqual([]);
});
