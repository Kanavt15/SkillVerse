/** Local-only authority fixtures, real proof forms, revoked sessions and native controls. */
import { createHmac } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, localRoleHeaders } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

const execute = promisify(execFile);
const headers = { origin: 'http://localhost:5173', 'x-skillverse-client': 'web' };
test.use({ actionTimeout: 15000, navigationTimeout: 30000 });
const password = 'staff-proof-learning-2026';
function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((value) => parseInt(value, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', bytes).update(counter).digest(),
    offset = digest.at(-1)! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
async function account(request: APIRequestContext, tag: string) {
  const user = {
    email: `staff_${tag}@skillverse.test`,
    username: `staff_${tag}`,
    displayName: `Staff fixture ${tag}`,
    password,
  };
  expect((await request.post('/api/v1/auth/register', { headers, data: user })).ok()).toBe(true);
  const mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
  const token = mailbox.data
    .find((entry: { to: string }) => entry.to === user.email)
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
  const id = (await (await request.get('/api/v1/me')).json()).data.id as string;
  const setup = (
    await (await request.post('/api/v1/me/mfa/totp/setup', { headers, data: {} })).json()
  ).data;
  const enabled = await request.post('/api/v1/me/mfa/totp/enable', {
    headers,
    data: { code: totp(setup.secret) },
  });
  const enabledBody = await enabled.json();
  expect(enabled.ok(), JSON.stringify(enabledBody.error)).toBe(true);
  const codes = enabledBody.data.recoveryCodes as string[];
  return { ...user, id, codes };
}
async function fixtureRole(id: string, grant: boolean) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid local fixture UUID');
  const api = fileURLToPath(new URL('../../api', import.meta.url)),
    root = fileURLToPath(new URL('../../../', import.meta.url));
  // Deliberately fixed to local D1: never uses remote/environment switches.
  await execute(
    process.execPath,
    [
      resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1',
      'execute',
      'skillverse-dev',
      '--local',
      '--command',
      grant
        ? `INSERT INTO user_roles(user_id,role,created_at) VALUES ('${id}','super_admin',${Date.now()})`
        : `DELETE FROM user_roles WHERE user_id = '${id}' AND role IN ('moderator','admin','super_admin')`,
    ],
    {
      cwd: api,
      timeout: 30000,
      env: { ...process.env, WRANGLER_LOG_PATH: resolve(root, 'tmp/e2e-fixture.log') },
    },
  );
}
test('super admin manages roles, safe audit and controls with fresh proof and native forms', async ({
  browser,
  extraHTTPHeaders,
  baseURL,
}) => {
  test.setTimeout(180000);
  const staffContext = await browser.newContext({
    baseURL,
    extraHTTPHeaders: localRoleHeaders(extraHTTPHeaders, 1),
  });
  const learnerContext = await browser.newContext({
    baseURL,
    extraHTTPHeaders: localRoleHeaders(extraHTTPHeaders, 2),
  });
  let rootId: string | undefined, targetId: string | undefined;
  try {
    expect((await (await staffContext.request.get('/api/v1/meta')).json()).data.environment).toBe(
      'development',
    );
    const tag = Date.now().toString(36),
      root = await account(staffContext.request, `${tag}a`),
      target = await account(learnerContext.request, `${tag}b`);
    rootId = root.id;
    targetId = target.id;
    await fixtureRole(root.id, true);
    expect(
      (await (await staffContext.request.get(`/api/v1/admin/users/${target.id}`)).json()).data
        .canManageRoles,
    ).toBe(true);
    const page = await staffContext.newPage(),
      errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/admin/users/${target.id}`);
    const role = page
      .locator('form')
      .filter({ has: page.locator('input[name="intent"][value="role"]') });
    await role.getByLabel('Role', { exact: true }).selectOption('admin');
    await role
      .getByLabel('Decision reason')
      .fill('Reviewed the new administrator responsibilities and verified their MFA.');
    await role.getByLabel('Your current password').fill('incorrect-password');
    await role.getByLabel('Fresh security code').fill(root.codes[0]!);
    await role.getByRole('button', { name: 'Confirm role decision' }).click();
    await expect(page.getByText('The security check did not pass.')).toBeVisible();
    await expect(role.getByLabel('Your current password')).toHaveValue('');
    await expect(role.getByLabel('Fresh security code')).toHaveValue('');
    await role.getByLabel('Role', { exact: true }).selectOption('admin');
    await role
      .getByLabel('Decision reason')
      .fill('Reviewed the new administrator responsibilities and verified their MFA.');
    await role.getByLabel('Your current password').fill(password);
    await role.getByLabel('Fresh security code').fill(root.codes[0]!);
    await role.getByRole('button', { name: 'Confirm role decision' }).click();
    await expect(page.getByRole('status')).toHaveText(/All target sessions were revoked/);
    expect((await learnerContext.request.get('/api/v1/me')).status()).toBe(401);
    const login = await learnerContext.request.post('/api/v1/auth/login', {
      headers,
      data: { email: target.email, password },
    });
    expect(login.ok()).toBe(true);
    expect(
      (
        await learnerContext.request.post('/api/v1/auth/mfa/verify', {
          headers,
          data: { code: target.codes[0] },
        })
      ).ok(),
    ).toBe(true);
    const targetPage = await learnerContext.newPage();
    await targetPage.goto('/admin/controls');
    await expect(
      targetPage.getByText('Only a super administrator can change controls.'),
    ).toBeVisible();
    await expect(targetPage.getByRole('button', { name: 'Save setting' })).toHaveCount(0);
    await page.goto('/admin/audit');
    await page.getByLabel('Exact action').fill('admin.role_granted');
    await page.getByLabel('Exact target ID').fill(target.id);
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`targetId=${target.id}`));
    await expect(page.locator('ol > li')).toHaveCount(1);
    await expect(page.getByText('Granted admin; all target sessions revoked.')).toBeVisible();
    await expect(
      page.getByText('Reviewed the new administrator responsibilities and verified their MFA.'),
    ).toBeVisible();
    await page.goto('/settings/security');
    await expect(page.getByText('Staff must keep MFA enabled.', { exact: false })).toBeVisible();
    await expect(page.getByText('Turn off two-factor authentication', { exact: true })).toHaveCount(
      0,
    );
    for (const theme of ['light', 'dark']) {
      await staffContext.addCookies([
        { name: 'sv_theme', value: theme, domain: 'localhost', path: '/' },
      ]);
      for (const path of ['/admin/audit', '/admin/operations', '/admin/controls']) {
        await page.goto(path);
        for (const width of [320, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
          await page.screenshot({
            path: fileURLToPath(
              new URL(
                `../../../tmp/staff-${path.split('/').at(-1)}-${theme}-${width}.png`,
                import.meta.url,
              ),
            ),
            fullPage: true,
          });
        }
      }
    }
    const nativeContext = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      storageState: await staffContext.storageState(),
      extraHTTPHeaders: localRoleHeaders(extraHTTPHeaders, 1),
    });
    try {
      const native = await nativeContext.newPage();
      await native.goto('/admin/controls');
      const card = native.getByRole('region', { name: 'Server errors per 5 minutes', exact: true });
      const current = Number(await card.locator('input[name="value"]').inputValue());
      await card.getByText('Change setting', { exact: true }).click();
      await card.getByLabel('New value').fill(String(current === 5 ? 9 : 5));
      await card
        .getByLabel('Decision reason')
        .fill('Staging fixture checks native operational setting updates.');
      await card.getByLabel('Your current password').fill(password);
      await card.getByLabel('Fresh security code').fill(root.codes[1]!);
      await card.getByRole('button', { name: 'Save setting' }).click();
      await expect(native.getByRole('status')).toHaveText(/Control saved/);
      await card.getByText('Change setting', { exact: true }).click();
      await card.getByLabel('New value').fill(String(current));
      await card
        .getByLabel('Decision reason')
        .fill('Restore the original threshold after the native-form verification.');
      await card.getByLabel('Your current password').fill(password);
      await card.getByLabel('Fresh security code').fill(root.codes[2]!);
      await card.getByRole('button', { name: 'Save setting' }).click();
      await expect(native.getByRole('status')).toHaveText(/Control saved/);
    } finally {
      await nativeContext.close();
    }
    await page.goto(`/admin/users/${target.id}`);
    await role.getByLabel('Role', { exact: true }).selectOption('admin');
    await role.getByLabel('Decision', { exact: true }).selectOption('revoke');
    await role
      .getByLabel('Decision reason')
      .fill('The temporary browser verification is complete; revoke staff access.');
    await role.getByLabel('Your current password').fill(password);
    await role.getByLabel('Fresh security code').fill(root.codes[3]!);
    await role.getByRole('button', { name: 'Confirm role decision' }).click();
    await expect(page.getByRole('status')).toHaveText(/All target sessions were revoked/);
    expect((await learnerContext.request.get('/api/v1/me')).status()).toBe(401);
    await page.goto(`/admin/users/${root.id}`);
    await expect(page.getByRole('button', { name: 'Confirm role decision' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (targetId) await fixtureRole(targetId, false);
    if (rootId) await fixtureRole(rootId, false);
    await staffContext.close();
    await learnerContext.close();
  }
});
