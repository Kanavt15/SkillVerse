-- Data migration: the top-level course categories every environment needs
-- (dev, staging, production). Slugs match INTEREST_OPTIONS in
-- packages/shared/src/constants.ts, so onboarding interests map to categories.
-- INSERT OR IGNORE keeps it safe if a category was already created by hand.
-- Timestamps: 1767225600000 = 2026-01-01T00:00:00Z.
INSERT OR IGNORE INTO categories (id, slug, name, description, icon, position, created_at, updated_at) VALUES
  ('01890000-0000-7000-8000-00000000c001', 'web-development', 'Web development', 'HTML, CSS, JavaScript, React, back-end and full-stack.', 'code', 10, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c002', 'mobile-development', 'Mobile apps', 'Android, iOS, Flutter and React Native.', 'smartphone', 20, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c003', 'data-science', 'Data science', 'Python, SQL, statistics, analytics and visualisation.', 'bar-chart-3', 30, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c004', 'ai-ml', 'AI & machine learning', 'Machine learning, deep learning and generative AI.', 'brain', 40, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c005', 'design', 'Design', 'UI/UX, graphic design, Figma and illustration.', 'palette', 50, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c006', 'marketing', 'Digital marketing', 'SEO, social media, content and performance marketing.', 'megaphone', 60, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c007', 'business', 'Business & startups', 'Entrepreneurship, management, sales and product.', 'briefcase', 70, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c008', 'personal-finance', 'Personal finance', 'Budgeting, investing basics and taxes in India.', 'indian-rupee', 80, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c009', 'languages', 'Languages', 'English, Hindi, regional and foreign languages.', 'languages', 90, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c010', 'music', 'Music', 'Instruments, vocals, theory and production.', 'music', 100, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c011', 'photography', 'Photography & video', 'Photography, video editing and content creation.', 'camera', 110, 1767225600000, 1767225600000),
  ('01890000-0000-7000-8000-00000000c012', 'writing', 'Writing', 'Copywriting, creative writing and communication.', 'pen-line', 120, 1767225600000, 1767225600000);
