/** Real Node HTTP server, isolated local gateway; no external providers or database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test(
  'Render runtime serves health, protects the proxy boundary and enforces CSRF/body limits',
  { timeout: 20000 },
  async () => {
    const gateway = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        request.url === '/limit'
          ? JSON.stringify({ success: true })
          : JSON.stringify({ success: true, results: [], meta: { changes: 0 } }),
      );
    });
    gateway.listen(0, '127.0.0.1');
    await once(gateway, 'listening');
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const key = 'isolated-server-proxy-key-0123456789abcdef';
    const child = spawn(process.execPath, ['apps/api/node/server.mjs'], {
      env: {
        ...process.env,
        PORT: String(port),
        ENVIRONMENT: 'staging',
        APP_ORIGINS: 'https://website.test',
        WEB_PROXY_KEY: key,
        D1_GATEWAY_URL: `http://127.0.0.1:${gateway.address().port}`,
        D1_GATEWAY_KEY: 'isolated-gateway-key-0123456789abcdef',
        EMAIL_FROM: 'SkillVerse <no-reply@example.test>',
        RESEND_API_KEY: 'isolated-provider-never-called',
        IP_HASH_SALT: 'isolated-ip-salt-0123456789abcdef012345',
        MFA_ENCRYPTION_KEY: 'a'.repeat(64),
        COOKIE_SIGNING_KEY: 'isolated-cookie-key-0123456789abcdef0123',
        CERTIFICATE_SIGNING_KEY: 'isolated-certificate-key-0123456789abcdef',
        ENFORCE_ADMIN_MFA: 'on',
        PASSWORD_BREACH_CHECK: 'on',
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        TURNSTILE_SECRET_KEY: '',
        OPS_ALERT_WEBHOOK_URL: '',
        OPERATIONS_TELEMETRY: 'off',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    try {
      await new Promise((resolve, reject) => {
        child.stdout.on('data', () => {
          if (output.includes('is listening')) resolve();
        });
        child.once('exit', (code) => reject(new Error(`Server exited ${code}: ${output}`)));
        child.once('error', reject);
      });
      const origin = `http://127.0.0.1:${port}`;
      const health = await fetch(`${origin}/api/health`);
      assert.equal(health.status, 200);
      assert.equal((await health.json()).checks.database, 'up');
      assert.equal((await fetch(`${origin}/api/v1/meta`)).status, 403);
      assert.equal(
        (await fetch(`${origin}/api/v1/meta`, { headers: { 'x-sv-proxy-key': 'forged' } })).status,
        403,
      );
      assert.equal(
        (await fetch(`${origin}/api/v1/me`, { headers: { 'x-sv-proxy-key': key } })).status,
        401,
      );
      const headers = {
        'x-sv-proxy-key': key,
        'x-skillverse-client': 'web',
        'content-type': 'application/json',
      };
      assert.equal(
        (
          await fetch(`${origin}/api/v1/auth/login`, {
            method: 'POST',
            headers: { ...headers, origin: 'https://attacker.test' },
            body: '{}',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${origin}/api/v1/auth/login`, {
            method: 'POST',
            headers: { ...headers, origin: 'https://website.test' },
            body: JSON.stringify({ email: 'x'.repeat(70000) }),
          })
        ).status,
        413,
      );
      assert.ok(!output.includes(key), 'Server logs must not reveal the proxy secret.');
    } finally {
      child.kill();
      await once(child, 'exit').catch(() => {});
      await new Promise((resolve) => gateway.close(resolve));
    }
  },
);
