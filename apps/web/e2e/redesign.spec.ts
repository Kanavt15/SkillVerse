/** Visual regression coverage uses actual API content and existing local account fixtures. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('the hero, real catalog cards and disclosures work in both themes on mobile and desktop', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const catalog = (await (await request.get('/api/v1/courses?price=free')).json()).data;
  for (const theme of ['light', 'dark']) {
    await page
      .context()
      .addCookies([{ name: 'sv_theme', value: theme, domain: 'localhost', path: '/' }]);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await expect(
        page.getByRole('heading', { name: 'Make room for your next skill.' }),
      ).toBeVisible();
      await expect(page.locator('#discover article')).toHaveCount(
        Math.min(catalog.items.length, 3),
      );
      for (const course of catalog.items.slice(0, 3))
        await expect(
          page.locator('#discover').getByRole('heading', { name: course.title, exact: true }),
        ).toBeVisible();
      await page.getByRole('button', { name: 'Can I try a course before signing up?' }).click();
      await expect(page.getByText('Yes. Lessons marked Preview', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await expect(
        page.getByRole('heading', { name: 'Make room for your next skill.' }),
      ).toBeInViewport();
      await page.screenshot({ path: `test-results/home-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.evaluate(() => scrollTo({ top: 300, behavior: 'instant' }));
  await expect
    .poll(() =>
      page
        .locator('.hero-motion')
        .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42),
    )
    .toBeLessThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => scrollTo(0, 300));
  await expect(page.locator('.hero-motion')).toHaveCSS('transform', 'none');
  await page.locator('#hero-search').fill('web page');
  await page.getByRole('button', { name: 'Explore courses', exact: true }).click();
  await expect(page).toHaveURL(/\/courses\?q=web\+page/);
  expect(errors).toEqual([]);
});

test('account menus and workspaces retain keyboard navigation, settings and POST sign-out', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  expect((await (await request.get('/api/v1/meta')).json()).data.environment).toBe('development');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const email of ['teacher@skillverse.test', 'admin@skillverse.test']) {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('learn-and-grow-2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    const surfaces = email.startsWith('teacher')
      ? ['/dashboard', '/learning', '/settings', '/settings/security', '/studio']
      : ['/admin', '/admin/applications', '/admin/courses', '/admin/reports', '/notifications'];
    for (const theme of ['light', 'dark']) {
      await page
        .context()
        .addCookies([{ name: 'sv_theme', value: theme, domain: 'localhost', path: '/' }]);
      for (const path of surfaces) {
        const width = theme === 'light' ? 1440 : 390;
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(path);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const accessibility = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(accessibility.violations).toEqual([]);
        await page.screenshot({
          path: `test-results/${email.split('@')[0]}-${path.replaceAll('/', '-')}-${theme}.png`,
          fullPage: true,
        });
      }
    }
    await page.getByRole('button', { name: 'Account menu', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Dashboard', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('public navigation, hero search and FAQs remain usable without JavaScript', async ({
  browser,
  extraHTTPHeaders,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173',
    javaScriptEnabled: false,
    extraHTTPHeaders,
    viewport: { width: 390, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByText('Can I try a course before signing up?', { exact: true }).click();
    await expect(page.getByText('Yes. Lessons marked Preview', { exact: false })).toBeVisible();
    await page.getByLabel('Open menu', { exact: true }).click();
    await expect(
      page
        .getByRole('navigation', { name: 'Mobile', exact: true })
        .getByRole('link', { name: 'Courses', exact: true }),
    ).toBeVisible();
    await page.locator('#hero-search').fill('web page');
    await page.getByRole('button', { name: 'Explore courses', exact: true }).click();
    await expect(page).toHaveURL(/\/courses\?q=web\+page/);
  } finally {
    await context.close();
  }
});
