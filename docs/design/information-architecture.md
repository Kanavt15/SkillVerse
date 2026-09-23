# Information architecture

Every page SkillVerse will have, grouped by audience, with the phase that ships it. ✅ = live.

## Public (server-rendered, indexed by search engines)

| Page                                                                                               | URL                            | Phase |
| -------------------------------------------------------------------------------------------------- | ------------------------------ | ----- |
| Home                                                                                               | `/`                            | ✅ 0  |
| 404                                                                                                | any unknown URL                | ✅ 0  |
| Explore / search                                                                                   | `/courses`                     | 1     |
| Category                                                                                           | `/categories/:slug`            | 1     |
| Course detail                                                                                      | `/courses/:slug`               | 1     |
| Instructor profile                                                                                 | `/instructors/:username`       | 1     |
| Skill Passport                                                                                     | `/@:username`                  | 4     |
| Certificate verification                                                                           | `/verify/:serial`              | 1     |
| Certifications catalog                                                                             | `/certifications`              | 4     |
| Mentors marketplace                                                                                | `/mentors`                     | 5     |
| Skill Swap board                                                                                   | `/swap`                        | 5     |
| Practice arena, problem                                                                            | `/practice`, `/practice/:slug` | 3     |
| Contests, leaderboards                                                                             | `/contests`, `/leaderboards`   | 3     |
| Skill Map roadmaps                                                                                 | `/roadmaps/:slug`              | 3     |
| Pricing (Plus, Teams)                                                                              | `/pricing`                     | 2/6   |
| Teach on SkillVerse                                                                                | `/teach`                       | 1     |
| For Business                                                                                       | `/business`                    | 7     |
| Blog                                                                                               | `/blog`, `/blog/:slug`         | 2     |
| Help center / FAQ                                                                                  | `/help`                        | 1     |
| About, Contact                                                                                     | `/about`, `/contact`           | 1     |
| Legal: Terms, Privacy, Refunds, Cookies, Instructor Terms, Community Guidelines, Grievance Officer | `/legal/*`                     | 1     |
| `robots.txt` ✅, `sitemap.xml`, `ads.txt`                                                          | root                           | 0/2   |

## Auth

| Page                                   | URL                                   | Status       |
| -------------------------------------- | ------------------------------------- | ------------ |
| Sign up                                | `/signup`                             | ✅ 1         |
| Check email / resend link              | `/check-email`                        | ✅ 1         |
| Confirm email                          | `/verify-email?token=…`               | ✅ 1         |
| Sign in                                | `/login?redirectTo=…`                 | ✅ 1         |
| Sign out                               | `POST /logout`                        | ✅ 1         |
| Forgot / reset password                | `/forgot-password`, `/reset-password` | ✅ 1         |
| Onboarding (goal, interests)           | `/onboarding`                         | ✅ 1         |
| Dashboard                              | `/dashboard`                          | ✅ 1 (basic) |
| Settings: profile / password & devices | `/settings`, `/settings/security`     | ✅ 1         |
| 2FA step                               | `/login/2fa`                          | ✅ 1         |
| Google sign-in                         | `/login`, `/signup` (button)          | ✅ 1         |
| Dev mailbox (development only)         | `/dev/mailbox`                        | ✅ 1         |

## Learner (signed in, `noindex`)

| Area                                                                                         | URL                               | Phase |
| -------------------------------------------------------------------------------------------- | --------------------------------- | ----- |
| Dashboard                                                                                    | `/dashboard`                      | 1     |
| My learning                                                                                  | `/learning`                       | 1     |
| Course player                                                                                | `/learn/:courseSlug/:lessonId`    | 1     |
| Wishlist, cart, checkout                                                                     | `/wishlist`, `/cart`, `/checkout` | 2     |
| Orders and invoices                                                                          | `/account/orders`                 | 2     |
| Wallet and credits                                                                           | `/account/wallet`                 | 2     |
| Subscription                                                                                 | `/account/subscription`           | 6     |
| Certificates                                                                                 | `/account/certificates`           | 1     |
| Bookings, messages                                                                           | `/account/bookings`, `/messages`  | 5     |
| Notifications                                                                                | `/notifications`                  | 1     |
| Settings: profile, security (sessions, 2FA), privacy (export/delete), notifications, billing | `/settings/*`                     | 1–2   |

## Instructor Studio (`/studio`, `noindex`)

Overview analytics · course builder (curriculum, pricing, coupons, landing page, submit for review) · Q&A inbox · reviews · students · earnings and payouts · mentoring availability · promotions · exam builder. Phases 1–6.

## Organisation admin (`/org`)

Seats, invites, assigned paths, reports. Phase 7.

## Platform admin (`/admin`, behind Cloudflare Access + admin role + 2FA)

Users · instructor applications · course review queue · moderation queue · orders and refunds · payouts · reconciliation · coupons · plans · ads and sponsored campaigns · platform settings · feature flags · announcements · audit log · system health. Phases 1–6.
