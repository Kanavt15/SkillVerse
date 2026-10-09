/** A learner asks, an instructor answers and staff moderate, using separate browser sessions. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const slug = 'build-your-first-web-page';
const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('learn-and-grow-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
test('learner and instructor discuss, accept an answer, report and restore content', async ({
  browser,
  page,
  request,
}) => {
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const tag = Date.now().toString(36),
    title = `How should I structure the page ${tag}?`;
  const user = {
    email: `community_${tag}@skillverse.test`,
    username: `community_${tag}`,
    displayName: 'Discussion Learner',
    password: 'learn-and-grow-2026',
  };
  expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
  const mailbox = await (await request.get('/api/v1/dev/mailbox')).json(),
    mail = mailbox.data.find((m: { to: string }) => m.to === user.email);
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
  expect(
    (await request.post(`/api/v1/learning/courses/${slug}/enroll`, { headers, data: {} })).ok(),
  ).toBe(true);
  const errors: string[] = [];
  const liveMessages: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('websocket', (socket) => {
    if (socket.url().includes('/me/notifications/live'))
      socket.on('framereceived', (frame) => {
        liveMessages.push(String(frame.payload));
      });
  });
  await login(page, user.email);
  await page.goto(`/courses/${slug}/questions`);
  await page.getByText('Ask a question', { exact: true }).click();
  await page.getByLabel('Question title', { exact: true }).fill(title);
  await page
    .getByLabel('Question details', { exact: true })
    .fill('I have a header and three sections. How should the main element fit around them?');
  await page.getByRole('button', { name: 'Post question', exact: true }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const thread = page.url();
  const teacherContext = await browser.newContext({ baseURL: 'http://localhost:5173' }),
    staffContext = await browser.newContext({ baseURL: 'http://localhost:5173' });
  const teacher = await teacherContext.newPage(),
    staff = await staffContext.newPage();
  try {
    await login(teacher, 'teacher@skillverse.test');
    await teacher.goto(thread);
    await teacher
      .getByLabel('Your reply', { exact: true })
      .fill(
        'Put the page-specific sections inside one main element, and keep the site header outside it.',
      );
    await teacher.getByRole('button', { name: 'Post reply', exact: true }).click();
    await expect(
      teacher.getByText(
        'Put the page-specific sections inside one main element, and keep the site header outside it.',
        { exact: true },
      ),
    ).toBeVisible();
    // The learner's page stays open while the instructor replies; verify actual live delivery.
    await expect.poll(() => liveMessages.includes('{"type":"refresh"}')).toBe(true);
    await expect(
      page.getByRole('link', { name: 'Notifications, 1 unread', exact: true }),
    ).toBeVisible();
    await page.goto('/notifications');
    await expect(
      page.getByRole('heading', { name: 'New reply in course Q&A', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Notifications, no unread', exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 });
    const inboxA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(inboxA11y.violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/notifications-mobile.png', fullPage: true });
    await page.getByText('Notification preferences', { exact: true }).click();
    await page.getByLabel('Notify me about course discussions', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Notification preferences saved.', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByText('Notification preferences', { exact: true }).click();
    await expect(
      page.getByLabel('Notify me about course discussions', { exact: true }),
    ).not.toBeChecked();
    await page.goto(thread);
    await page.getByRole('button', { name: 'Accept answer', exact: true }).click();
    await expect(page.getByText('Accepted answer', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(a11y.violations).toEqual([]);
    await page.screenshot({ path: 'test-results/discussion-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Report reply', exact: true }).click();
    await page.getByLabel('Reason', { exact: true }).selectOption('misleading');
    await page
      .getByLabel('What happened?', { exact: true })
      .fill(`Please review the example in this answer ${tag}.`);
    await page.getByRole('button', { name: 'Send report', exact: true }).click();
    await expect(
      page.getByText('Your report has been sent privately to the moderation team.', {
        exact: true,
      }),
    ).toBeVisible();
    await login(staff, 'admin@skillverse.test');
    await staff.goto('/admin/reports');
    await staff.getByRole('article').filter({ hasText: tag }).getByRole('link').click();
    await expect(staff.getByRole('heading', { name: 'Review reply', exact: true })).toBeVisible();
    const reportUrl = staff.url();
    await staff
      .getByLabel('Decision feedback', { exact: true })
      .fill('Hidden while the example is being reviewed.');
    await staff.getByRole('button', { name: 'Hide content', exact: true }).click();
    await expect(staff.getByText('Decision saved.', { exact: true })).toBeVisible();
    await page.goto(thread);
    await expect(page.getByText('Accepted answer', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(
        'Put the page-specific sections inside one main element, and keep the site header outside it.',
        { exact: true },
      ),
    ).toHaveCount(0);
    await staff.goto(reportUrl);
    await staff
      .getByLabel('Decision feedback', { exact: true })
      .fill('Restored after checking the example and its context.');
    await staff.getByRole('button', { name: 'Restore content', exact: true }).click();
    await expect(staff.getByText('Decision saved.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(
        'Put the page-specific sections inside one main element, and keep the site header outside it.',
        { exact: true },
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await teacherContext.close();
    await staffContext.close();
  }
});
