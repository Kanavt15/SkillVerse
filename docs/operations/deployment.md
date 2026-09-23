# Deployment guide

From nothing to SkillVerse running on Cloudflare. You deploy **staging** first (free `*.workers.dev` URLs, safe to experiment) and then **production** (your own domain).

Run all commands from the repository root unless a step says otherwise.

## 0. One-time prerequisites

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up.
2. Log in from your terminal (this opens a browser window):
   ```bash
   npx wrangler login
   ```
3. Find your **workers.dev subdomain**: Dashboard → Workers & Pages → the right-hand panel shows `<something>.workers.dev`. You'll need it below.

## 1. Staging

### 1.1 Create the staging database

```bash
cd apps/api
npx wrangler d1 create skillverse-staging
```

It prints a `database_id`. In `apps/api/wrangler.jsonc`, inside `env.staging`, replace:

- `REPLACE_WITH_STAGING_D1_ID` with that id;
- `REPLACE_WITH_SUBDOMAIN` (in `APP_ORIGINS`) with your workers.dev subdomain.

### 1.2 Set the staging secrets

Generate a random value and store it as a secret (paste it when asked):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put IP_HASH_SALT --env staging
```

Repeat for every secret listed in the [README environment table](../../README.md#10-environment-variables-and-secrets).

**Email (`RESEND_API_KEY`):** create a free account at https://resend.com, add and verify your sending domain (it gives you DNS records to add in Cloudflare), create an API key, then `npx wrangler secret put RESEND_API_KEY --env staging`. Set `EMAIL_FROM` in `wrangler.jsonc` to an address on that domain. Without this, users can't verify their email or reset passwords on staging and production.

### 1.3 Migrate and deploy

```bash
cd ../..
npm run db:migrate:staging
npm run deploy:staging        # deploys the API first, then the website
```

The API must be deployed before the website, because the website's service binding points to it. `deploy:staging` does them in that order.

### 1.4 Check it

- Website: `https://skillverse-web-staging.<subdomain>.workers.dev`
- Health: `https://skillverse-web-staging.<subdomain>.workers.dev/api/health` should return `"status":"ok"`.

## 2. Production

### 2.1 Domain

1. Buy a domain (Cloudflare Registrar sells at cost) or move an existing one to Cloudflare: Dashboard → Add a site → follow the nameserver instructions.
2. In `apps/api/wrangler.jsonc` and `apps/web/wrangler.jsonc`, replace every `REPLACE_WITH_DOMAIN` with your domain (e.g. `skillverse.in`).
   - The website route `skillverse.in/*` and the API route `skillverse.in/api/*` coexist, and the more specific route wins.

### 2.2 Database and secrets

```bash
cd apps/api
npx wrangler d1 create skillverse-prod          # put the id in env.production → REPLACE_WITH_PROD_D1_ID
npx wrangler secret put IP_HASH_SALT --env production    # use a NEW random value, never reuse staging's
cd ../..
npm run db:migrate:prod
```

### 2.3 Deploy

```bash
npm run deploy:api
npm run deploy:web
```

### 2.4 Cloudflare dashboard settings (once)

| Setting                          | Value             | Where                            |
| -------------------------------- | ----------------- | -------------------------------- |
| SSL/TLS encryption mode          | **Full (strict)** | SSL/TLS → Overview               |
| Always Use HTTPS                 | On                | SSL/TLS → Edge Certificates      |
| Minimum TLS version              | 1.2               | SSL/TLS → Edge Certificates      |
| Bot Fight Mode                   | On                | Security → Bots                  |
| WAF managed rules (free set)     | On                | Security → WAF                   |
| Web Analytics (privacy-friendly) | On                | Analytics & Logs → Web Analytics |

### 2.5 Verify

```bash
curl -s https://<domain>/api/health
curl -sI https://<domain>/ | grep -i -E "content-security-policy|strict-transport"
```

Then open the site, click around, and check the browser console for errors.

Add a free uptime monitor (e.g. UptimeRobot) on `https://<domain>/api/health` with an alert to your email.

## 3. Every later release

1. `npm run check` passes locally, and the change works on `npm run dev`.
2. If there are new migrations, apply them to staging, deploy staging and test.
3. Apply migrations to production **before** deploying the code that needs them (`npm run db:migrate:prod`).
4. `npm run deploy:api`, then `npm run deploy:web`.
5. Smoke test production (health, home page, the feature you changed).

## 4. Rolling back

Dashboard → Workers & Pages → the Worker → **Deployments** → pick the previous version → **Rollback**. This rolls back code only. Database changes need a new migration or a restore from [backups.md](backups.md), which is why migrations must stay backwards compatible.

## 5. Upgrade path (when traffic grows)

| Signal                                                      | Upgrade                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Close to 100,000 requests/day, or CPU-limit errors (`1102`) | Workers Paid ($5/month): 10M requests/month and 30 s CPU. No code changes.          |
| Video buffering / large courses                             | Cloudflare Stream (adaptive streaming, paid per minute)                             |
| Database close to 500 MB                                    | Workers Paid (10 GB per D1 database), then shard or move to Postgres via Hyperdrive |
