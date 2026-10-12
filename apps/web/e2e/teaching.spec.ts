/** Real application/teaching journeys: native withdrawal, feedback, approval and course review locks. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures';

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

test('applicant withdraws, revises after feedback and is approved through native forms with private history', async ({
  browser,
  page,
  request,
  extraHTTPHeaders,
}) => {
  test.setTimeout(240_000);
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const tag = Date.now().toString(36),
    user = {
      email: `teaching_${tag}@skillverse.test`,
      username: `teaching_${tag}`,
      displayName: `Teaching Applicant ${tag}`,
      password,
    };
  expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
  const mailbox = (await (await request.get('/api/v1/dev/mailbox')).json()).data;
  const token = mailbox
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
  await login(page, user.email);
  const nativeContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  const staffContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
  });
  const native = await nativeContext.newPage(),
    staff = await staffContext.newPage();
  const errors: string[] = [];
  for (const view of [page, staff]) view.on('pageerror', (error) => errors.push(error.message));
  const appCard = () =>
    staff
      .locator('li')
      .filter({ has: staff.getByRole('heading', { name: user.displayName, exact: true }) });
  try {
    const category = (await (await request.get('/api/v1/categories')).json()).data[0];
    await native.goto('/teach');
    await native.getByLabel('Your headline', { exact: true }).fill(`Workshop teacher ${tag}`);
    await native.getByLabel(category.name, { exact: true }).check();
    await native.getByLabel('Your experience', { exact: true }).fill('Too short');
    await native.getByRole('button', { name: 'Send application', exact: true }).click();
    await expect(native.getByLabel('Your headline', { exact: true })).toHaveValue(
      `Workshop teacher ${tag}`,
    );
    await native
      .getByLabel('Your experience', { exact: true })
      .fill(
        'I have led practical writing workshops for four years and give learners original exercises with individual feedback on every draft.',
      );
    await native.getByRole('button', { name: 'Send application', exact: true }).click();
    await expect(
      native.getByRole('heading', { name: 'Application received', exact: true }),
    ).toBeVisible();
    const first = (
      await (await nativeContext.request.get('/api/v1/me/instructor-application')).json()
    ).data;
    await login(staff, 'admin@skillverse.test');
    await staff.goto('/admin/applications');
    await expect(appCard().getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    await native.getByRole('button', { name: 'Withdraw application', exact: true }).click();
    await expect(
      native.getByRole('heading', { name: 'Apply to teach', exact: true }),
    ).toBeVisible();
    await expect(native.getByText('Withdrawn', { exact: true })).toBeVisible();
    expect(
      (
        await staffContext.request.post(
          `/api/v1/admin/instructor-applications/${first.id}/approve`,
          { headers, data: {} },
        )
      ).status(),
    ).toBe(409);
    await staff
      .getByRole('navigation', { name: 'Filter by status' })
      .getByRole('link', { name: 'Withdrawn', exact: true })
      .click();
    await expect(appCard().getByText('Withdrawn by the applicant', { exact: false })).toBeVisible();
    await expect(appCard().getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    await native
      .getByLabel('Your headline', { exact: true })
      .fill(`Revised workshop teacher ${tag}`);
    await native.getByRole('button', { name: 'Send application', exact: true }).click();
    await expect(
      native.getByRole('heading', { name: 'Application received', exact: true }),
    ).toBeVisible();
    await staff.goto('/admin/applications');
    await appCard().getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(appCard().getByRole('alert')).toContainText('Explain what needs to change');
    await expect(staff.locator('button[aria-haspopup="menu"]')).toBeVisible();
    const feedback =
      'Please include a clearer practical teaching demonstration. <script>window.teachingReasonExecuted=true</script> ' +
      'x'.repeat(200);
    await appCard().getByLabel('Note to the applicant', { exact: true }).fill(feedback);
    await appCard().getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(
      staff.getByRole('status').filter({ hasText: 'Rejected. Feedback sent.' }),
    ).toBeVisible();
    await native.goto('/teach');
    await expect(
      native.getByRole('status').filter({ hasText: "Your last application wasn't approved yet." }),
    ).toContainText(feedback);
    for (const theme of ['light', 'dark']) {
      for (const context of [page.context(), staffContext])
        await context.addCookies([
          { name: 'sv_theme', value: theme, domain: 'localhost', path: '/' },
        ]);
      for (const width of [320, 390, 1440]) {
        for (const [view, path] of [
          [page, '/teach'],
          [staff, '/admin/applications?status=rejected'],
          [staff, '/admin/applications?status=withdrawn'],
        ] as const) {
          await view.setViewportSize({ width, height: 1000 });
          await view.goto(path);
          expect(
            await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page: view })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
                .analyze()
            ).violations,
          ).toEqual([]);
          if (width === 390)
            await view.screenshot({
              path: `test-results/teaching-${path === '/teach' ? 'applicant' : path.includes('rejected') ? 'rejected' : 'withdrawn'}-${theme}.png`,
              fullPage: true,
            });
        }
      }
    }
    expect(await page.evaluate(() => 'teachingReasonExecuted' in window)).toBe(false);
    await native
      .getByLabel('Your experience', { exact: true })
      .fill(
        'I have led practical writing workshops for four years. My revised demonstration includes a complete original exercise, its learning goal and examples of actionable learner feedback.',
      );
    await native.getByRole('button', { name: 'Send application', exact: true }).click();
    await expect(
      native.getByRole('heading', { name: 'Application received', exact: true }),
    ).toBeVisible();
    await staff.goto('/admin/applications');
    await appCard()
      .getByLabel('Note to the applicant', { exact: true })
      .fill('Approved after reviewing the revised teaching demonstration.');
    await appCard().getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(
      staff.getByRole('status').filter({ hasText: 'Approved. They can now use the Studio.' }),
    ).toBeVisible();
    await native.goto('/teach');
    await expect(
      native.getByRole('heading', { name: "You're an instructor", exact: true }),
    ).toBeVisible();
    const history = (
      await (await nativeContext.request.get('/api/v1/me/instructor-applications')).json()
    ).data;
    expect(history.map((entry: { status: string }) => entry.status)).toEqual([
      'approved',
      'rejected',
      'withdrawn',
    ]);
    await native.getByRole('link', { name: 'Open the Studio', exact: true }).click();
    await expect(
      native.getByRole('heading', { name: 'Instructor Studio', exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await (await request.get('/api/v1/dev/mailbox')).json()).data.some(
          (mail: { to: string; text: string }) =>
            mail.to === user.email && mail.text.includes('application to teach was approved'),
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    const response = await nativeContext.request.get('/api/v1/me/instructor-application');
    if (response.ok()) {
      const current = (await response.json()).data;
      if (current?.status === 'pending')
        await nativeContext.request.post(
          `/api/v1/me/instructor-applications/${current.id}/withdraw`,
          { headers, data: {} },
        );
    }
    await nativeContext.close();
    await staffContext.close();
  }
});

test('instructor withdraws a course, addresses rejection feedback and staff publishes the resubmission', async ({
  browser,
  page,
  request,
  extraHTTPHeaders,
}) => {
  test.setTimeout(180_000);
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const staffContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
  });
  const staff = await staffContext.newPage();
  let courseId: string | undefined;
  try {
    await login(page, 'teacher@skillverse.test');
    const created = await page.request.post('/api/v1/studio/courses', {
      headers,
      data: { title: `Review workflow ${Date.now().toString(36)}` },
    });
    expect(created.ok()).toBe(true);
    let course = (await created.json()).data;
    courseId = course.id;
    const categoryId = (await (await request.get('/api/v1/categories')).json()).data[0].id;
    expect(
      (
        await page.request.patch(`/api/v1/studio/courses/${course.id}`, {
          headers,
          data: {
            subtitle: 'Practice clear writing with original workshop exercises',
            description:
              'A practical writing course with original exercises and guided revision. '.repeat(5),
            categoryId,
            learningOutcomes: [
              'Write an introduction',
              'Structure a paragraph',
              'Revise a short draft',
            ],
          },
        })
      ).ok(),
    ).toBe(true);
    course = (
      await (
        await page.request.post(`/api/v1/studio/courses/${course.id}/sections`, {
          headers,
          data: { title: 'Original writing exercises' },
        })
      ).json()
    ).data;
    for (const title of ['Introductions', 'Paragraphs', 'Revision'])
      course = (
        await (
          await page.request.post(`/api/v1/studio/sections/${course.sections[0].id}/lessons`, {
            headers,
            data: { title, type: 'article' },
          })
        ).json()
      ).data;
    for (const lesson of course.sections[0].lessons)
      expect(
        (
          await page.request.patch(`/api/v1/studio/lessons/${lesson.id}`, {
            headers,
            data: {
              contentMarkdown:
                'Write about a skill you have learned. Read the paragraph aloud, identify each unclear sentence and revise it with a concrete example.',
            },
          })
        ).ok(),
      ).toBe(true);
    await page.goto(`/studio/courses/${course.id}`);
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Withdraw from review', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
    await login(staff, 'admin@skillverse.test');
    await staff.goto(`/admin/courses/${course.id}`);
    await expect(staff.getByRole('button', { name: 'Publish course', exact: true })).toHaveCount(0);
    expect(
      (
        await staffContext.request.post(`/api/v1/admin/course-reviews/${course.id}/approve`, {
          headers,
          data: {
            version: (
              await (
                await staffContext.request.get(`/api/v1/admin/course-reviews/${course.id}`)
              ).json()
            ).data.course.version,
          },
        })
      ).status(),
    ).toBe(409);
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
    await staff.reload();
    await staff.getByRole('button', { name: 'Request changes', exact: true }).click();
    await expect(staff.getByRole('alert')).toContainText('Explain what needs to change');
    await expect(staff.locator('button[aria-haspopup="menu"]')).toBeVisible();
    await staff
      .getByLabel('Notes for the instructor', { exact: true })
      .fill('Please clarify the expected learning outcomes in the subtitle.');
    await staff.getByRole('button', { name: 'Request changes', exact: true }).click();
    await expect(staff).toHaveURL(/decided=returned/);
    await page.reload();
    await expect(
      page.getByText('Please clarify the expected learning outcomes in the subtitle.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
    await page
      .getByLabel('Subtitle', { exact: true })
      .fill('Learn to structure clear paragraphs and revise your own writing');
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Details saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
    await staff.goto(`/admin/courses/${course.id}`);
    await expect(
      staff.getByText('Learn to structure clear paragraphs and revise your own writing', {
        exact: true,
      }),
    ).toBeVisible();
    await staff.getByRole('button', { name: 'Publish course', exact: true }).click();
    await expect(staff).toHaveURL(/decided=published/);
    await page.reload();
    await expect(
      page.getByRole('status').filter({ hasText: 'This course is live.' }),
    ).toBeVisible();
    expect((await request.get(`/api/v1/courses/${course.slug}`)).status()).toBe(200);
    await page.getByRole('button', { name: 'Edit draft revision', exact: true }).click();
    await expect(page).not.toHaveURL(`/studio/courses/${course.id}`);
    const revisionId = new URL(page.url()).pathname.split('/').at(-1)!;
    const revisionTitle = `Reviewed course revision ${Date.now().toString(36)}`;
    await expect(page.getByText('This is a private revision.', { exact: false })).toBeVisible();
    await page.getByLabel('Title', { exact: true }).fill(revisionTitle);
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Details saved' })).toBeVisible();
    expect((await (await request.get(`/api/v1/courses/${course.slug}`)).json()).data.title).toBe(
      course.title,
    );
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
    await staff.goto(`/admin/courses/${revisionId}`);
    await expect(
      staff.getByText('This submission proposes changes', { exact: false }),
    ).toBeVisible();
    await staff
      .getByLabel('Notes for the instructor', { exact: true })
      .fill('Please confirm the course description matches the revised title.');
    await staff.getByRole('button', { name: 'Request changes', exact: true }).click();
    await expect(staff).toHaveURL(/decided=returned/);
    await page.reload();
    await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
    await staff.goto(`/admin/courses/${revisionId}`);
    for (const width of [320, 1440]) {
      await staff.setViewportSize({ width, height: 1000 });
      expect(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (
          await new AxeBuilder({ page: staff })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await staff.getByRole('button', { name: 'Publish course', exact: true }).click();
    await expect(staff).toHaveURL(/decided=published/);
    expect((await (await request.get(`/api/v1/courses/${course.slug}`)).json()).data.title).toBe(
      revisionTitle,
    );
    await page.goto(`/studio/courses/${course.id}`);
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  } finally {
    if (courseId) {
      const response = await page.request.get(`/api/v1/studio/courses/${courseId}`);
      if (response.ok()) {
        const current = (await response.json()).data;
        if (current.status === 'in_review')
          await page.request.post(`/api/v1/studio/courses/${courseId}/withdraw`, {
            headers,
            data: {},
          });
        if (current.status !== 'archived')
          await page.request.post(`/api/v1/studio/courses/${courseId}/archive`, {
            headers,
            data: {
              version: (
                await (await page.request.get(`/api/v1/studio/courses/${current.id}`)).json()
              ).data.version,
            },
          });
      }
    }
    await staffContext.close();
  }
});
