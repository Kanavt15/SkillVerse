/** Instructor authors, staff review and a learner practices before earning completion. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('learn-and-grow-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('instructor creates a quiz, staff publish it and a learner passes after feedback', async ({
  browser,
  extraHTTPHeaders,
  page,
  request,
}) => {
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const errors: string[] = [];
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
  for (const view of [page, teacher, staff]) view.on('pageerror', (e) => errors.push(e.message));
  try {
    await login(teacher, 'teacher@skillverse.test');
    const tag = Date.now().toString(36),
      title = `Browser quiz course ${tag}`,
      quizTitle = 'Check your HTML understanding';
    const created = await teacherContext.request.post('/api/v1/studio/courses', {
      headers,
      data: { title },
    });
    expect(created.ok()).toBe(true);
    let course = (await created.json()).data;
    const categoryId = (await (await request.get('/api/v1/categories')).json()).data[0].id;
    expect(
      (
        await teacherContext.request.patch(`/api/v1/studio/courses/${course.id}`, {
          headers,
          data: {
            subtitle: 'Learn the basics and check what you remember',
            description: 'Original HTML examples for a friendly introduction. '.repeat(7),
            categoryId,
            learningOutcomes: [
              'Recognize headings',
              'Choose meaningful structure',
              'Understand links',
            ],
          },
        })
      ).ok(),
    ).toBe(true);
    const section = await teacherContext.request.post(
      `/api/v1/studio/courses/${course.id}/sections`,
      { headers, data: { title: 'Learn and practice' } },
    );
    course = (await section.json()).data;
    const sectionId = course.sections[0].id;
    for (const lessonTitle of ['Read the basics', 'Build a small page']) {
      const added = await teacherContext.request.post(
        `/api/v1/studio/sections/${sectionId}/lessons`,
        { headers, data: { title: lessonTitle, type: 'article' } },
      );
      course = (await added.json()).data;
      const lessonId = course.sections[0].lessons.at(-1).id;
      expect(
        (
          await teacherContext.request.patch(`/api/v1/studio/lessons/${lessonId}`, {
            headers,
            data: {
              contentMarkdown:
                'An h1 identifies the main heading. An anchor element links to another page. '.repeat(
                  3,
                ),
            },
          })
        ).ok(),
      ).toBe(true);
    }
    await teacher.goto(`/studio/courses/${course.id}`);
    await expect(teacher.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await teacher.getByRole('textbox', { name: 'New lesson title' }).fill(quizTitle);
    await teacher.getByLabel('Lesson type', { exact: true }).selectOption('quiz');
    await teacher.getByRole('button', { name: 'Add lesson', exact: true }).click();
    await teacher.getByRole('link', { name: quizTitle, exact: true }).click();
    await expect(teacher.getByRole('heading', { name: 'Quiz lesson', exact: true })).toBeVisible();
    await teacher.getByRole('button', { name: 'Add question', exact: true }).click();
    await teacher
      .getByLabel('Question 1 text', { exact: true })
      .fill('What does the h1 element represent?');
    await teacher.getByLabel('Choice 1 for question 1', { exact: true }).fill('The main heading');
    await teacher.getByLabel('Choice 2 for question 1', { exact: true }).fill('A layout detail');
    await teacher
      .getByLabel('Explanation for question 1', { exact: true })
      .fill('Use h1 for the main heading of your page.');
    // Server validation preserves incomplete input and names the missing correct answer.
    await teacher.getByRole('button', { name: 'Save lesson', exact: true }).click();
    await expect(teacher.getByRole('alert')).toContainText('Choose the correct answer');
    await expect(teacher.getByLabel('Question 1 text', { exact: true })).toHaveValue(
      'What does the h1 element represent?',
    );
    await teacher.getByLabel('Choice 1 is correct for question 1', { exact: true }).check();
    await teacher.getByRole('button', { name: 'Add question', exact: true }).click();
    await teacher
      .getByLabel('Question 2 text', { exact: true })
      .fill('Which element creates a link to another page?');
    await teacher.getByLabel('Choice 1 for question 2', { exact: true }).fill('The anchor element');
    await teacher
      .getByLabel('Choice 2 for question 2', { exact: true })
      .fill('The paragraph element');
    await teacher.getByLabel('Choice 1 is correct for question 2', { exact: true }).check();
    await teacher
      .getByLabel('Explanation for question 2', { exact: true })
      .fill('An anchor uses its href attribute to identify the destination.');
    await teacher.getByLabel('Passing score (%)', { exact: true }).fill('100');
    await teacher.getByLabel('Free preview', { exact: false }).check();
    await teacher.getByRole('button', { name: 'Save lesson', exact: true }).click();
    await expect(teacher.getByRole('status')).toContainText('Lesson saved');
    await teacher.setViewportSize({ width: 390, height: 844 });
    await teacher.evaluate(() => window.scrollTo(0, 0));
    expect(
      (
        await new AxeBuilder({ page: teacher })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await teacher.screenshot({ path: 'test-results/quiz-authoring-mobile.png', fullPage: true });
    await teacher.getByRole('link', { name: 'Back to curriculum', exact: false }).click();
    await teacher.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(
      teacher.getByText('This course is waiting for review', { exact: false }),
    ).toBeVisible();
    course = (
      await (await teacherContext.request.get(`/api/v1/studio/courses/${course.id}`)).json()
    ).data;
    const quizId = course.sections[0].lessons.find((l: { type: string }) => l.type === 'quiz').id;
    await login(staff, 'admin@skillverse.test');
    await staff.goto(`/admin/courses/${course.id}`);
    await staff.getByText(quizTitle, { exact: true }).click();
    await expect(
      staff.getByText('What does the h1 element represent?', { exact: true }),
    ).toBeVisible();
    await expect(staff.getByText('Correct answer', { exact: true })).toHaveCount(2);
    await staff.getByRole('button', { name: 'Publish course', exact: true }).click();
    await expect(staff).toHaveURL(/\/admin\/courses\?decided=published$/);

    await page.goto(`/learn/${course.slug}/${quizId}`);
    await expect(
      page.getByText('Enroll in this course to submit answers', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText('Use h1 for the main heading of your page.', { exact: true }),
    ).toHaveCount(0);
    const user = {
      email: `quiz_${tag}@skillverse.test`,
      username: `quiz_${tag}`,
      displayName: 'Quiz Learner',
      password: 'learn-and-grow-2026',
    };
    expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
    const mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
    const token = mailbox.data
      .find((m: { to: string }) => m.to === user.email)
      ?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(
      (await request.post('/api/v1/auth/verify-email', { headers, data: { token } })).ok(),
    ).toBe(true);
    await request.patch('/api/v1/me/profile', { headers, data: { completeOnboarding: true } });
    await request.post('/api/v1/auth/logout', { headers, data: {} });
    await login(page, user.email);
    await page.goto(`/courses/${course.slug}`);
    await page.getByRole('button', { name: 'Enroll for free' }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${course.slug}/`));
    await page.getByRole('link', { name: quizTitle, exact: false }).click();
    await expect(page.getByRole('heading', { name: quizTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toHaveCount(0);
    await page.getByRole('radio', { name: 'A layout detail', exact: true }).check();
    await page.getByRole('radio', { name: 'The paragraph element', exact: true }).check();
    await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
    await expect(page.getByText('Keep practicing · 0%', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Use h1 for the main heading of your page.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Course completed', exact: true })).toHaveCount(
      0,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page
        .context()
        .addCookies([{ name: 'sv_theme', value: theme, domain: 'localhost', path: '/' }]);
      await page.reload();
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/quiz-feedback-${theme}-mobile.png`,
        fullPage: true,
      });
    }
    await page.getByRole('radio', { name: 'The main heading', exact: true }).focus();
    await page.getByRole('radio', { name: 'The main heading', exact: true }).press('Space');
    await expect(page.getByRole('radio', { name: 'The main heading', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: 'The anchor element', exact: true }).check();
    await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
    await expect(page.getByText('Quiz passed · 100%', { exact: true })).toBeVisible();
    for (const lesson of course.sections[0].lessons.filter(
      (l: { type: string }) => l.type === 'article',
    ))
      expect(
        (
          await page
            .context()
            .request.post(`/api/v1/learning/courses/${course.slug}/lessons/${lesson.id}/progress`, {
              headers,
              data: { completed: true },
            })
        ).ok(),
      ).toBe(true);
    await page.reload();
    await page.getByRole('button', { name: 'Get completion certificate', exact: true }).click();
    await expect(page).toHaveURL(/\/verify\//);
    await expect(page.getByText('Verified completion', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await teacherContext.close();
    await staffContext.close();
  }
});
