import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const slug = 'build-your-first-web-page';
const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };

test('catalog search and previews work on desktop and mobile in both themes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'What will you learn next?' })).toBeVisible();
  await page.getByRole('searchbox').fill('web page');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build your first web page' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Python for everyday problems' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Build your first web page', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in to enroll' })).toBeVisible();
  await page
    .getByRole('link', { name: /Preview/ })
    .first()
    .click();
  await expect(page.getByText('You’re watching a free preview.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toHaveCount(0);
  await page.goto('/courses');
  for (const theme of ['light', 'dark']) {
    await page
      .context()
      .addCookies([{ name: 'sv_theme', value: theme, domain: 'localhost', path: '/' }]);
    await page.reload();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.screenshot({ path: `test-results/catalog-${theme}-${width}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test('a new learner enrolls, saves a private note, resumes, reviews and verifies completion', async ({
  page,
  request,
}) => {
  // The mailbox and demo content only exist locally. Never run this against a live environment.
  const meta = await (await request.get('/api/v1/meta')).json();
  expect(meta.data.environment).toBe('development');
  const tag = Date.now().toString(36);
  const user = {
    email: `e2e_${tag}@skillverse.test`,
    username: `e2e_${tag}`,
    displayName: 'Browser Learner',
    password: 'learn-and-grow-2026',
  };
  expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
  const mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
  const mail = mailbox.data.find((entry: { to: string }) => entry.to === user.email);
  const token = mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
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
  expect((await request.post('/api/v1/auth/logout', { headers, data: {} })).ok()).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/login?redirectTo=${encodeURIComponent(`/courses/${slug}`)}`);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Enroll for free' }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${slug}/`));
  await page
    .getByLabel('Note', { exact: true })
    .fill('Remember to use semantic HTML for the main page sections.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Remember to use semantic HTML for the main page sections.', { exact: true }),
  ).toBeVisible();
  const firstLesson = page.url();
  await page.getByRole('button', { name: 'Complete & next' }).click();
  await expect(page).not.toHaveURL(firstLesson);
  const secondLesson = page.url();
  await page.goto('/learning');
  await expect(page.getByText('1 of 3 lessons', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Continue learning', exact: true }).click();
  await expect(page).toHaveURL(secondLesson);
  await page.goto(`/courses/${slug}`);
  await page.getByRole('link', { name: 'Continue learning', exact: true }).click();
  await expect(page).toHaveURL(secondLesson);
  await page.getByRole('button', { name: 'Complete & next' }).click();
  await expect(page).not.toHaveURL(secondLesson);
  await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Course completed' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Get completion certificate' }).click();
  await expect(page).toHaveURL(/\/verify\/[0-9a-f-]+$/);
  await expect(page.getByRole('main').getByText('Browser Learner', { exact: true })).toBeVisible();
  await expect(page.getByText('Verified completion', { exact: true })).toBeVisible();
  const verification = page.url();
  await page.screenshot({ path: 'test-results/completion-certificate.png', fullPage: true });
  await page.goto(`/courses/${slug}`);
  await page
    .getByLabel('Your experience', { exact: true })
    .fill('A clear introduction that helped me create a useful first page.');
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Your review was saved.', { exact: true })).toBeVisible();
  await page.goto('/account/certificates');
  await expect(page.getByRole('link', { name: 'View & share', exact: true })).toBeVisible();
  await page.context().clearCookies();
  await page.goto(verification);
  await expect(page.getByText('Verified completion', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
