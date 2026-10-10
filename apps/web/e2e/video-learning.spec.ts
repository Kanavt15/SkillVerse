/** Local instructor-to-learner coverage for real authored timelines, privacy, reflection notes and shortcuts. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures';

type CourseFixture = {
  id: string;
  slug: string;
  status: string;
  sections: { id: string; lessons: { id: string }[] }[];
};

const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('learn-and-grow-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('authored video chapters, transcript search and private reflections work across the learning workflow', async ({
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
  let authoredCourseId: string | undefined;
  for (const view of [page, teacher, staff]) {
    view.on('pageerror', (e) => errors.push(e.message));
    // Verify our embed URLs without depending on the provider's network or playback availability.
    await view.route('https://www.youtube-nocookie.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><title>Test video host</title><body>Video host test frame</body></html>',
      }),
    );
  }
  try {
    await login(teacher, 'teacher@skillverse.test');
    const tag = Date.now().toString(36);
    const created = await teacherContext.request.post('/api/v1/studio/courses', {
      headers,
      data: { title: `Browser video learning ${tag}` },
    });
    expect(created.ok()).toBe(true);
    let course: CourseFixture = (await created.json()).data;
    authoredCourseId = course.id;
    const categoryId = (await (await request.get('/api/v1/categories')).json()).data[0].id;
    expect(
      (
        await teacherContext.request.patch(`/api/v1/studio/courses/${course.id}`, {
          headers,
          data: {
            subtitle: 'Learn from a video and put each idea into practice',
            description:
              'Explore semantic page structure and write a clear heading for your project. '.repeat(
                5,
              ),
            categoryId,
            learningOutcomes: [
              'Identify a useful heading',
              'Choose a page structure',
              'Explain your choices',
            ],
          },
        })
      ).ok(),
    ).toBe(true);
    course = (
      await (
        await teacherContext.request.post(`/api/v1/studio/courses/${course.id}/sections`, {
          headers,
          data: { title: 'Build your understanding' },
        })
      ).json()
    ).data;
    const sectionId = course.sections[0]!.id;
    for (const [title, type] of [
      ['Watch the structure lesson', 'video'],
      ['Try a small page', 'article'],
      ['Reflect on your choices', 'article'],
    ] as const) {
      course = (
        await (
          await teacherContext.request.post(`/api/v1/studio/sections/${sectionId}/lessons`, {
            headers,
            data: { title, type },
          })
        ).json()
      ).data;
      if (type === 'article') {
        expect(
          (
            await teacherContext.request.patch(
              `/api/v1/studio/lessons/${course.sections[0]!.lessons.at(-1)!.id}`,
              {
                headers,
                data: {
                  contentMarkdown:
                    'Write one main heading and a short paragraph that explains what your page is about. '.repeat(
                      2,
                    ),
                },
              },
            )
          ).ok(),
        ).toBe(true);
      }
    }
    const videoId = course.sections[0]!.lessons[0]!.id;
    const articleId = course.sections[0]!.lessons[1]!.id;
    await teacher.goto(`/studio/courses/${course.id}/lessons/${videoId}`);
    await expect(teacher.locator('button[aria-haspopup="menu"]')).toBeVisible();
    await teacher
      .getByLabel('Video link', { exact: true })
      .fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    await teacher
      .getByLabel('Video chapters', { exact: true })
      .fill('0:00 | Introduction\n0:00 | Structure');
    await teacher.getByRole('button', { name: 'Save lesson', exact: true }).click();
    await expect(teacher.getByRole('alert')).toContainText('increasing timestamps');
    await expect(teacher.locator('button[aria-haspopup="menu"]')).toBeVisible();
    await expect(teacher.getByLabel('Video chapters', { exact: true })).toHaveValue(
      '0:00 | Introduction\n0:00 | Structure',
    );
    await teacher
      .getByLabel('Video chapters', { exact: true })
      .fill('0:00 | Introduction\n0:30 | Structure\n1:30 | Try it');
    await teacher
      .getByLabel('Timed transcript', { exact: true })
      .fill(
        '0:00 | Start with a clear heading.\n0:30 | Semantic structure makes a page easier to follow.\n1:30 | <script>window.timelineAttack = true</script>',
      );
    await teacher
      .getByLabel('Practice checkpoints', { exact: true })
      .fill(
        '0:30 | What heading would describe your project? | Use a short heading that names the main idea.',
      );
    await teacher.getByLabel('Free preview', { exact: false }).check();
    await teacher.getByRole('button', { name: 'Save lesson', exact: true }).click();
    await expect(teacher.getByRole('status')).toContainText('Lesson saved');
    await teacher.reload();
    await expect(teacher.getByLabel('Video chapters', { exact: true })).toHaveValue(
      '0:00 | Introduction\n0:30 | Structure\n1:30 | Try it',
    );
    await teacher.setViewportSize({ width: 390, height: 900 });
    expect(
      (
        await new AxeBuilder({ page: teacher })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await teacher.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await teacher.screenshot({ path: 'test-results/video-authoring-mobile.png', fullPage: true });
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
    await staff.getByText('Watch the structure lesson', { exact: true }).click();
    await expect(staff.getByRole('heading', { name: 'Video chapters', exact: true })).toBeVisible();
    await staff.locator('summary').filter({ hasText: 'Inspect transcript' }).click();
    await expect(
      staff.getByText('Semantic structure makes a page easier to follow.', { exact: false }),
    ).toBeVisible();
    await staff.getByRole('button', { name: 'Publish course', exact: true }).click();
    await expect(staff).toHaveURL(/\/admin\/courses\?decided=published/);

    const path = `/learn/${course.slug}/${videoId}`;
    await page.goto(path);
    await expect(page.getByText('You’re watching a free preview.', { exact: false })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Read transcript' }).click();
    await page.getByRole('searchbox', { name: 'Search transcript' }).fill('semantic');
    await expect(page.getByRole('status').filter({ hasText: 'matching cue' })).toHaveText(
      '1 matching cue',
    );
    await page.getByRole('link', { name: 'Jump to 0:30 in transcript', exact: true }).click();
    await expect(page).toHaveURL(/\?t=30#lesson-video/);
    await expect(page.getByRole('searchbox', { name: 'Search transcript' })).toHaveValue(
      'semantic',
    );
    await expect(page.locator('#lesson-video iframe')).toHaveAttribute('src', /start=30/);
    const bar = page.getByRole('region', { name: 'Lesson keyboard navigation', exact: true });
    await bar.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\?t=90#lesson-video/);
    await bar.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page).toHaveURL(/\?t=90#lesson-video/); // The adjacent lesson is private.
    await page.getByRole('searchbox', { name: 'Search transcript' }).fill('');
    await expect(page.locator('.video-transcript script')).toHaveCount(0);
    expect(await page.evaluate(() => Object.hasOwn(window, 'timelineAttack'))).toBe(false);

    const user = {
      email: `video_${tag}@skillverse.test`,
      username: `video_${tag}`,
      displayName: 'Video Browser Learner',
      password: 'learn-and-grow-2026',
    };
    expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
    const mail = (await (await request.get('/api/v1/dev/mailbox')).json()).data.find(
      (entry: { to: string }) => entry.to === user.email,
    );
    const token = mail.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(
      (await request.post('/api/v1/auth/verify-email', { headers, data: { token } })).ok(),
    ).toBe(true);
    expect(
      (
        await request.patch('/api/v1/me/profile', {
          headers,
          data: { completeOnboarding: true, interests: ['programming'], goal: 'upskill' },
        })
      ).ok(),
    ).toBe(true);
    await login(page, user.email);
    await page.goto(`/courses/${course.slug}`);
    await expect(page.getByRole('button', { name: 'Enroll for free' })).toBeVisible();
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page.locator('button[aria-haspopup="menu"]')).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Checkpoint at 0:30' }).click();
    await page
      .getByLabel('Your reflection at 0:30', { exact: true })
      .fill('My heading will describe a small garden journal.');
    await page
      .getByRole('button', { name: 'Save reflection as private note', exact: true })
      .click();
    await expect(
      page.getByText('My heading will describe a small garden journal.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Your reflection at 0:30', { exact: true })).toHaveValue('');
    await expect(page.getByRole('link', { name: 'Jump to 0:30', exact: true })).toBeVisible();
    await expect(page.getByText('0 of 3 completed', { exact: true })).toBeVisible();
    const checkpoint = page
      .locator('summary')
      .filter({ hasText: 'Checkpoint at 0:30' })
      .locator('..');
    if (!(await checkpoint.evaluate((element) => (element as HTMLDetailsElement).open)))
      await checkpoint.locator(':scope > summary').click();
    await page.locator('summary').filter({ hasText: 'Show instructor explanation' }).click();
    await expect(
      page.getByText('Use a short heading that names the main idea.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Your reflection at 0:30', { exact: true }).focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page).toHaveURL(new RegExp(videoId));

    for (const theme of ['light', 'dark']) {
      await page
        .context()
        .addCookies([{ name: 'sv_theme', value: theme, domain: 'localhost', path: '/' }]);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(path);
        await page.locator('summary').filter({ hasText: 'Read transcript' }).click();
        await page.locator('summary').filter({ hasText: 'Checkpoint at 0:30' }).click();
        const bounds = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowing: [...document.querySelectorAll('main *, header *')]
            .filter((el) => el.getBoundingClientRect().right > innerWidth)
            .map((el) => ({
              tag: el.tagName,
              class: el.className,
              right: el.getBoundingClientRect().right,
            }))
            .slice(-15),
        }));
        expect(bounds.scrollWidth, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.width);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({
          path: `test-results/video-learning-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await page.getByRole('region', { name: 'Lesson keyboard navigation', exact: true }).focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page).toHaveURL(new RegExp(articleId));

    const native = await browser.newContext({
      baseURL: 'http://localhost:5173',
      javaScriptEnabled: false,
      extraHTTPHeaders,
      viewport: { width: 320, height: 900 },
    });
    try {
      const view = await native.newPage();
      await view.route('https://www.youtube-nocookie.com/**', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="en"><title>Test video host</title><body>Video host test frame</body></html>',
        }),
      );
      await view.goto(path);
      await view
        .getByRole('navigation', { name: 'Video chapters', exact: true })
        .getByRole('link', { name: '0:30 Structure', exact: true })
        .click();
      await expect(view).toHaveURL(/\?t=30#lesson-video/);
      await expect(view.locator('#lesson-video iframe')).toHaveAttribute('src', /start=30/);
      await view.locator('summary').filter({ hasText: 'Read transcript' }).click();
      await expect(view.getByRole('searchbox', { name: 'Search transcript' })).toHaveCount(0);
      await expect(
        view.getByText('Semantic structure makes a page easier to follow.', { exact: true }),
      ).toBeVisible();
    } finally {
      await native.close();
    }
    expect(errors).toEqual([]);
  } finally {
    if (authoredCourseId) {
      const saved = await teacherContext.request.get(`/api/v1/studio/courses/${authoredCourseId}`);
      if (saved.ok()) {
        const current: CourseFixture = (await saved.json()).data;
        if (current.status === 'in_review')
          await teacherContext.request.post(`/api/v1/studio/courses/${authoredCourseId}/withdraw`, {
            headers,
            data: {},
          });
        if (current.status !== 'archived')
          await teacherContext.request.post(`/api/v1/studio/courses/${authoredCourseId}/archive`, {
            headers,
            data: {},
          });
      }
    }
    await teacherContext.close();
    await staffContext.close();
  }
});

test('public help and about pages are accessible in both themes and the hero cue reaches discovery', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await page
      .context()
      .addCookies([{ name: 'sv_theme', value: theme, domain: 'localhost', path: '/' }]);
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 950 });
      for (const path of ['/help', '/about']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: `test-results/${path.slice(1)}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Scroll down Find your starting point', exact: false })
    .click();
  await expect(page).toHaveURL(/#discover$/);
  await expect(page.locator('#discover')).toBeInViewport();
});
