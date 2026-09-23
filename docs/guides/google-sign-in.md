# Guide: set up "Continue with Google"

Google sign-in is **off by default**. The button only appears when all three are true:

1. `GOOGLE_CLIENT_ID` is set (a `var` in `apps/api/wrangler.jsonc`, or in `apps/api/.dev.vars` locally);
2. `GOOGLE_CLIENT_SECRET` is set (a secret);
3. the `auth.google` feature flag is on.

How it works and why it's safe: [docs/architecture/authentication.md](../architecture/authentication.md#google-sign-in).

## 1. Create OAuth credentials in Google Cloud (free)

1. Open https://console.cloud.google.com and create a project (e.g. "SkillVerse").
2. **APIs & Services → OAuth consent screen**
   - User type: **External**.
   - App name "SkillVerse", your support email, your logo (optional), and links to your privacy policy and terms (required before publishing).
   - Scopes: `openid`, `email`, `profile` only. Nothing else is needed.
   - While in **Testing** mode, only the test users you list can sign in. Publish the app when you launch.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**.
   - **Authorized redirect URIs**: add one per environment. They must match exactly:

| Environment | Redirect URI                                                                              |
| ----------- | ----------------------------------------------------------------------------------------- |
| Local       | `http://localhost:5173/api/v1/auth/google/callback`                                       |
| Staging     | `https://skillverse-web-staging.<your-subdomain>.workers.dev/api/v1/auth/google/callback` |
| Production  | `https://<your-domain>/api/v1/auth/google/callback`                                       |

- You don't need "Authorized JavaScript origins": the browser never talks to Google's APIs directly.

4. Copy the **Client ID** and **Client secret**.

## 2. Configure SkillVerse

**Locally** (`apps/api/.dev.vars`, which is never committed):

```
GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-…
```

Then switch the flag on in your local database:

```bash
cd apps/api
npx wrangler d1 execute DB --local --command "UPDATE feature_flags SET enabled = 1 WHERE key = 'auth.google'"
```

Restart `npm run dev`. The sign-in and sign-up pages now show **Continue with Google**.

**Staging / production:**

1. Put the client ID in `apps/api/wrangler.jsonc` → `env.<name>.vars.GOOGLE_CLIENT_ID` (it's public, not a secret).
2. `npx wrangler secret put GOOGLE_CLIENT_SECRET --env production`
3. Deploy the API.
4. Turn on the flag in that environment's database:
   `npx wrangler d1 execute DB --remote --env production --command "UPDATE feature_flags SET enabled = 1 WHERE key = 'auth.google'"`
   (The admin panel will do this from Phase 1's admin chunk onward.)

## 3. Test it

Click **Continue with Google**, pick an account, and you should land on onboarding (new account) or your dashboard.

| You see                                              | Cause                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Google error `redirect_uri_mismatch`                 | The redirect URI in Google Cloud doesn't exactly match the table above.                           |
| Back on /login with "did not complete"               | Check the API log for `oauth.google_failed`: it says why (e.g. `state mismatch`, `bad audience`). |
| Back on /login with "not available right now"        | Client ID/secret missing, or the `auth.google` flag is off.                                       |
| "Access blocked: app not verified" / only some users | The consent screen is in Testing mode: add test users or publish the app.                         |
