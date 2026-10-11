/** Staff search/archive through native forms; public visibility and existing learning after moderation. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures';

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('learn-and-grow-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('staff archives a publication with a native reason form and enrolled learners keep access', async ({
  browser,
  page,
  request,
  extraHTTPHeaders,
}) => {
  test.setTimeout(180_000);
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const teacherContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
  });
  const staffContext = await browser.newContext({
    baseURL: 'http://localhost:5173',
    extraHTTPHeaders,
  });
  const teacher = await teacherContext.newPage(),
    staff = await staffContext.newPage();
  const errors: string[] = [];
  for (const view of [page, teacher, staff])
    view.on('pageerror', (error) => errors.push(error.message));
  let courseId: string | undefined;
  try {
    await login(teacher, 'teacher@skillverse.test');
    const title = `Publication moderation ${Date.now().toString(36)}`;
    const created = await teacherContext.request.post('/api/v1/studio/courses', {
      headers,
      data: { title },
    });
    expect(created.ok()).toBe(true);
    let course = (await created.json()).data;
    courseId = course.id;
    const categoryId = (await (await request.get('/api/v1/categories')).json()).data[0].id;
    expect(
      (
        await teacherContext.request.patch(`/api/v1/studio/courses/${course.id}`, {
          headers,
          data: {
            subtitle: 'Practice structured writing with original examples',
            description: 'A practical writing workshop with examples and exercises. '.repeat(6),
            categoryId,
            learningOutcomes: [
              'Structure an introduction',
              'Write a clear paragraph',
              'Revise a short draft',
            ],
          },
        })
      ).ok(),
    ).toBe(true);
    course = (
      await (
        await teacherContext.request.post(`/api/v1/studio/courses/${course.id}/sections`, {
          headers,
          data: { title: 'Writing practice' },
        })
      ).json()
    ).data;
    for (const lessonTitle of ['A clear introduction', 'Useful paragraphs', 'Revision practice']) {
      course = (
        await (
          await teacherContext.request.post(
            `/api/v1/studio/sections/${course.sections[0].id}/lessons`,
            { headers, data: { title: lessonTitle, type: 'article' } },
          )
        ).json()
      ).data;
    }
    for (const lesson of course.sections[0].lessons) {
      expect(
        (
          await teacherContext.request.patch(`/api/v1/studio/lessons/${lesson.id}`, {
            headers,
            data: {
              contentMarkdown: `# ${lesson.title}\n\nWrite a short paragraph about a skill you have learned. Read it aloud and revise each unclear sentence.`,
              isPreview: true,
            },
          })
        ).ok(),
      ).toBe(true);
    }
    expect(
      (
        await teacherContext.request.post(`/api/v1/studio/courses/${course.id}/submit`, {
          headers,
          data: {},
        })
      ).ok(),
    ).toBe(true);
    await login(staff, 'admin@skillverse.test');
    await staff.goto(`/admin/courses/${course.id}`);
    await staff.getByRole('button', { name: 'Publish course', exact: true }).click();
    await expect(staff).toHaveURL(/decided=published/);
    await login(page, 'learner@skillverse.test');
    expect(
      (
        await page.request.post(`/api/v1/learning/courses/${course.slug}/enroll`, {
          headers,
          data: {},
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/learn/${course.slug}/${course.sections[0].lessons[0].id}`);
    await expect(
      page.getByRole('heading', { name: 'A clear introduction', exact: true, level: 1 }),
    ).toBeVisible();
    await staff
      .getByRole('navigation', { name: 'Admin sections' })
      .getByRole('link', { name: 'Course catalog', exact: true })
      .click();
    await staff.getByLabel('Search courses', { exact: true }).fill(title);
    await staff.getByLabel('Course status', { exact: true }).selectOption('published');
    await staff.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(staff.getByText('1 matching course', { exact: true })).toBeVisible();
    await staff.getByRole('link', { name: title, exact: true }).click();
    await expect(
      staff.getByRole('heading', { name: 'Archive publication', exact: true }),
    ).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await staffContext.addCookies([
        { name: 'sv_theme', value: theme, domain: 'localhost', path: '/' },
      ]);
      for (const width of [320, 390, 1440]) {
        await staff.setViewportSize({ width, height: 1000 });
        for (const path of [
          `/admin/catalog?q=${encodeURIComponent(title)}`,
          `/admin/courses/${course.id}`,
        ]) {
          await staff.goto(path);
          expect(
            await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page: staff })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
                .analyze()
            ).violations,
          ).toEqual([]);
          if (width === 390)
            await staff.screenshot({
              path: `test-results/course-moderation-${path.includes('/courses/') ? 'inspection' : 'catalog'}-${theme}.png`,
              fullPage: true,
            });
        }
      }
    }
    const nativeContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      extraHTTPHeaders,
      javaScriptEnabled: false,
      storageState: await staffContext.storageState(),
    });
    try {
      const native = await nativeContext.newPage();
      await native.goto(`/admin/courses/${course.id}`);
      await native.getByLabel('Archival reason', { exact: true }).fill('short');
      await native.getByRole('button', { name: 'Archive published course', exact: true }).click();
      await expect(native.getByRole('alert')).toContainText(
        'Explain the decision in at least 10 characters.',
      );
      const reason =
        'Editorial review found misleading course claims. <script>window.archiveReasonExecuted=true</script> ' +
        'x'.repeat(300);
      await native.getByLabel('Archival reason', { exact: true }).fill(reason);
      await native.getByRole('button', { name: 'Archive published course', exact: true }).click();
      await expect(
        native.getByRole('status').filter({ hasText: 'Course archived.' }),
      ).toBeVisible();
      await expect(native.getByText(reason, { exact: true })).toBeVisible();
      await native.getByRole('link', { name: 'Course catalog', exact: true }).first().click();
      await native.getByLabel('Search courses', { exact: true }).fill(title);
      await native.getByLabel('Course status', { exact: true }).selectOption('archived');
      await native.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(native.getByText('1 matching course', { exact: true })).toBeVisible();
    } finally {
      await nativeContext.close();
    }
    await staff.goto(`/admin/courses/${course.id}`);
    expect(await staff.evaluate(() => 'archiveReasonExecuted' in window)).toBe(false);
    await expect(
      staff.getByRole('button', { name: 'Archive published course', exact: true }),
    ).toHaveCount(0);
    expect((await request.get(`/api/v1/courses/${course.slug}`)).status()).toBe(404);
    expect(
      (
        await request.get(
          `/api/v1/courses/${course.slug}/lessons/${course.sections[0].lessons[0].id}`,
        )
      ).status(),
    ).toBe(404);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'A clear introduction', exact: true, level: 1 }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mark incomplete', exact: true })).toBeVisible();
    await teacher.goto(`/studio/courses/${course.id}`);
    await expect(teacher.getByText('Latest staff feedback:', { exact: false })).toContainText(
      'Editorial review found misleading course claims.',
    );
    // Recheck after archival: untrusted, unbroken feedback must wrap in every receiving surface.
    for (const theme of ['light', 'dark']) {
      for (const context of [teacherContext, staffContext])
        await context.addCookies([
          { name: 'sv_theme', value: theme, domain: 'localhost', path: '/' },
        ]);
      for (const width of [320, 390, 1440]) {
        for (const [view, path] of [
          [staff, `/admin/courses/${course.id}`],
          [teacher, '/studio'],
          [teacher, `/studio/courses/${course.id}`],
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
        }
      }
    }
    await expect
      .poll(async () =>
        (await (await request.get('/api/v1/dev/mailbox')).json()).data.some(
          (mail: { to: string; text: string }) =>
            mail.to === 'teacher@skillverse.test' &&
            mail.text.includes(title) &&
            mail.text.includes('Our team archived'),
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    if (courseId) {
      const response = await teacherContext.request.get(`/api/v1/studio/courses/${courseId}`);
      if (response.ok()) {
        const current = (await response.json()).data;
        if (current.status === 'in_review')
          await teacherContext.request.post(`/api/v1/studio/courses/${courseId}/withdraw`, {
            headers,
            data: {},
          });
        if (current.status !== 'archived')
          await teacherContext.request.post(`/api/v1/studio/courses/${courseId}/archive`, {
            headers,
            data: {},
          });
      }
    }
    await teacherContext.close();
    await staffContext.close();
  }
});
