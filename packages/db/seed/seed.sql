-- ─────────────────────────────────────────────────────────────────────────────
-- Development seed data. Safe to run repeatedly (INSERT OR IGNORE).
-- Applied by `npm run db:seed` → wrangler d1 execute DB --local --file=…
--
-- Values are platform defaults from the business plan (docs/business/revenue-model.md).
-- Money is integer paise; percentages are basis points (3000 = 30%).
-- Timestamps are epoch milliseconds (1767225600000 = 2026-01-01T00:00:00Z).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO platform_settings (key, value, description, updated_at) VALUES
  ('commerce.platform_fee_bps',          '3000', 'Platform commission on marketplace course sales (basis points).', 1767225600000),
  ('commerce.instructor_link_fee_bps',   '500',  'Platform commission when the sale came from the instructor''s own link or coupon.', 1767225600000),
  ('commerce.mentoring_fee_bps',         '1500', 'Platform commission on 1:1 mentoring sessions.', 1767225600000),
  ('commerce.cohort_fee_bps',            '2000', 'Platform commission on cohort and workshop tickets.', 1767225600000),
  ('commerce.refund_window_days',        '7',    'Days after purchase during which a course can be refunded.', 1767225600000),
  ('commerce.refund_max_progress_pct',   '30',   'Refunds are refused once this % of the course has been consumed.', 1767225600000),
  ('plus.instructor_pool_bps',           '5000', 'Share of net Plus subscription revenue paid to instructors by watch-minutes.', 1767225600000),
  ('ads.enabled',                        'false','Master switch for all third-party ads.', 1767225600000);

INSERT OR IGNORE INTO feature_flags (key, enabled, rollout_percent, description, updated_at) VALUES
  ('ads.adsense',        0, 100, 'Serve Google AdSense units (needs AdSense approval + consent).', 1767225600000),
  ('ads.house',          1, 100, 'Serve SkillVerse house ads in ad slots.', 1767225600000),
  ('auth.google',        0, 100, 'Allow "Continue with Google" sign-in.', 1767225600000),
  ('commerce.checkout',  0, 100, 'Allow paid checkout through Razorpay.', 1767225600000);
