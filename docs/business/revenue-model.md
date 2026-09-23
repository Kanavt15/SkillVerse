# Revenue model

SkillVerse earns from several streams that reinforce each other. **Free** features (free courses, skill swap, practice, community) attract learners. Learners generate ad impressions, subscriptions and purchases. Revenue attracts instructors, whose content attracts more learners.

All rates are **defaults** stored in the `platform_settings` table (see `packages/db/seed/seed.sql`). Admins change them without a code deploy. Money is handled in integer paise, and splits use basis points (3000 bp = 30%).

## Revenue streams

| #   | Stream                     | How it works                                                                                                  | Default split                                                                                       | Phase |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| 1   | Course marketplace         | Instructors sell courses (₹199–₹4,999 typical)                                                                | 70% instructor / 30% platform. **95/5** when the sale came from the instructor's own link or coupon | 2     |
| 2   | SkillVerse Plus            | ₹299/month or ₹2,499/year: Plus catalog, no ads, AI tutor, unlimited practice, 1 exam attempt/quarter         | 50% of net revenue → instructor pool, split by engaged watch-minutes                                | 6     |
| 3   | Paid certifications        | Timed, proctored-lite exams (₹499–₹1,999) with verifiable credentials; retake fee                             | 100% platform exams; 70/30 partner-authored                                                         | 4     |
| 4   | 1:1 mentoring              | Mentors set hourly rates; payment held until the session completes                                            | 85% mentor / 15% platform                                                                           | 5     |
| 5   | Cohorts and live workshops | Seat-capped scheduled classes, ticketed                                                                       | 80 / 20                                                                                             | 7     |
| 6   | Google AdSense             | Display ads on free pages only (catalog, blog, practice, free-course pages) for non-Plus users, consent-gated | 100% platform                                                                                       | 2     |
| 7   | Sponsored listings         | Instructors pay per click (from wallet) to promote courses, labelled "Promoted"                               | 100% platform                                                                                       | 6     |
| 8   | Credits and gift cards     | Prepaid wallet credits for courses, exams, boosts, streak freezes                                             | Float + unused balances                                                                             | 2     |
| 9   | Referral and affiliate     | Credits for referrals; affiliates earn % of first purchases                                                   | Marketing cost                                                                                      | 2     |
| 10  | Teams (B2B)                | ~₹999/seat/year: org dashboard, assigned paths, reports                                                       | Platform (instructors paid from pool)                                                               | 7     |
| 11  | Careers / hiring           | Paid job posts and recruiter search over opt-in, certified Skill Passports                                    | 100% platform                                                                                       | 7     |
| 12  | Contest sponsorships       | Companies sponsor coding contests and prizes                                                                  | 100% platform                                                                                       | 3+    |

## Worked example: one course sale

Course price **₹499** (`49900` paise), sold through the marketplace (30% platform fee):

| Line                               | Paise  | ₹      |
| ---------------------------------- | ------ | ------ |
| Learner pays                       | 49,900 | 499.00 |
| Platform share (30%, rounded down) | 14,970 | 149.70 |
| Instructor share (the remainder)   | 34,930 | 349.30 |

Calculated by `splitAmount(49900, 3000)` in `packages/shared/src/money.ts`. The platform fee rounds down and the instructor receives the remainder, so the parts always add up exactly.

Gateway fees (~2% for Razorpay) and GST are handled in Phase 2. The exact treatment (whether fees are deducted before the split) is decided there and documented in this file.

## Ads policy

- Ads show only on free surfaces, never in the lesson player, checkout, exams, sign-in, settings or admin.
- No ads for Plus and Teams users.
- Ads load only after consent (Google-certified consent banner for EEA/UK). Until AdSense approves the site, ad slots show **house ads** (e.g. "Try Plus", "Become a mentor").
- Ad slots reserve their space so the page doesn't jump (layout stability).

## Refund policy (default)

- Courses: refundable within **7 days** of purchase if **< 30%** of the course has been consumed.
- Exams: refundable only before the first attempt starts.
- Mentoring: refundable if cancelled more than 24 h before the session.

Values are in `platform_settings` (`commerce.refund_window_days`, `commerce.refund_max_progress_pct`).

## Signature features that support revenue

Skill Passport (hiring value → certifications), Demand Radar (tells instructors what to build → better catalog), Seasons with a Plus track (subscription upsell without paywalling learning), Sponsor-a-Learner (CSR budgets), Commitment Pledges (higher completion rates; forfeits fund scholarships, not the platform). The full list with phases is in the master plan and [roadmap](../phases/roadmap.md).
