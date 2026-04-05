-- Migration: Advanced Search Upgrade
-- Description: Adds tag system, FULLTEXT indexes, and optimized composite indexes
-- Date: 2026-04-05

USE skillverse;

-- ============================================================================
-- 1. CREATE TAGS SYSTEM TABLES
-- ============================================================================

-- Course Tags Table
-- Stores reusable tags for course classification
CREATE TABLE IF NOT EXISTS course_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_slug (slug),
    INDEX idx_usage_count (usage_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Course-Tag Relations Table (Junction Table)
-- Many-to-many relationship between courses and tags
CREATE TABLE IF NOT EXISTS course_tag_relations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES course_tags(id) ON DELETE CASCADE,
    UNIQUE KEY unique_course_tag (course_id, tag_id),
    INDEX idx_course_id (course_id),
    INDEX idx_tag_id (tag_id),
    INDEX idx_course_tag (course_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. ADD FULLTEXT INDEXES TO COURSES TABLE
-- ============================================================================

-- FULLTEXT index for natural language search on title and description
-- Note: MySQL FULLTEXT requires minimum word length (default 3-4 chars)
-- Configure ft_min_word_len in my.cnf if needed
ALTER TABLE courses 
ADD FULLTEXT INDEX idx_fulltext_search (title, description);

-- FULLTEXT index for title only (higher relevance for title matches)
ALTER TABLE courses 
ADD FULLTEXT INDEX idx_fulltext_title (title);

-- ============================================================================
-- 3. ADD COMPOSITE INDEXES FOR QUERY OPTIMIZATION
-- ============================================================================

-- Composite index for common filter combinations
-- Optimizes: WHERE is_published=1 AND category_id=X AND difficulty_level=Y
ALTER TABLE courses 
ADD INDEX idx_published_category_difficulty (is_published, category_id, difficulty_level);

-- Covering index for sorting by rating
-- Optimizes: ORDER BY avg_rating DESC, review_count DESC
ALTER TABLE courses 
ADD INDEX idx_rating_review_count (avg_rating DESC, review_count DESC);

-- Covering index for sorting by date
-- Optimizes: ORDER BY created_at DESC
-- (Already exists as idx_title, but we'll verify)

-- Composite index for published courses with rating filter
-- Optimizes: WHERE is_published=1 AND avg_rating >= X
ALTER TABLE courses 
ADD INDEX idx_published_rating (is_published, avg_rating DESC);

-- Composite index for published courses with price filter
-- Optimizes: WHERE is_published=1 AND price BETWEEN X AND Y
ALTER TABLE courses 
ADD INDEX idx_published_price (is_published, price);

-- Composite index for published courses with duration filter
-- Optimizes: WHERE is_published=1 AND duration_hours BETWEEN X AND Y
ALTER TABLE courses 
ADD INDEX idx_published_duration (is_published, duration_hours);

-- ============================================================================
-- 4. POPULATE INITIAL TAGS
-- ============================================================================

INSERT INTO course_tags (name, slug, description) VALUES
-- Programming Languages
('JavaScript', 'javascript', 'JavaScript programming language'),
('Python', 'python', 'Python programming language'),
('Java', 'java', 'Java programming language'),
('C++', 'cpp', 'C++ programming language'),
('PHP', 'php', 'PHP programming language'),
('Ruby', 'ruby', 'Ruby programming language'),
('Go', 'go', 'Go programming language'),
('TypeScript', 'typescript', 'TypeScript programming language'),
('Swift', 'swift', 'Swift programming language'),
('Kotlin', 'kotlin', 'Kotlin programming language'),

-- Web Development
('Web Development', 'web-development', 'Building websites and web applications'),
('Frontend', 'frontend', 'Frontend web development'),
('Backend', 'backend', 'Backend web development'),
('Full Stack', 'full-stack', 'Full stack web development'),
('React', 'react', 'React JavaScript library'),
('Angular', 'angular', 'Angular framework'),
('Vue.js', 'vuejs', 'Vue.js framework'),
('Node.js', 'nodejs', 'Node.js runtime environment'),
('Express', 'express', 'Express.js framework'),
('Next.js', 'nextjs', 'Next.js framework'),

-- Mobile Development
('Mobile Development', 'mobile-development', 'Mobile app development'),
('iOS Development', 'ios-development', 'iOS app development'),
('Android Development', 'android-development', 'Android app development'),
('React Native', 'react-native', 'React Native framework'),
('Flutter', 'flutter', 'Flutter framework'),

-- Data & AI
('Data Science', 'data-science', 'Data science and analysis'),
('Machine Learning', 'machine-learning', 'Machine learning and AI'),
('Deep Learning', 'deep-learning', 'Deep learning and neural networks'),
('Artificial Intelligence', 'ai', 'Artificial intelligence'),
('Data Analysis', 'data-analysis', 'Data analysis and visualization'),
('Big Data', 'big-data', 'Big data technologies'),
('SQL', 'sql', 'SQL and database queries'),
('NoSQL', 'nosql', 'NoSQL databases'),

-- DevOps & Tools
('DevOps', 'devops', 'DevOps practices and tools'),
('Docker', 'docker', 'Docker containerization'),
('Kubernetes', 'kubernetes', 'Kubernetes orchestration'),
('AWS', 'aws', 'Amazon Web Services'),
('Azure', 'azure', 'Microsoft Azure'),
('Git', 'git', 'Git version control'),
('CI/CD', 'cicd', 'Continuous Integration/Deployment'),

-- Design
('UI Design', 'ui-design', 'User Interface design'),
('UX Design', 'ux-design', 'User Experience design'),
('Graphic Design', 'graphic-design', 'Graphic design'),
('Web Design', 'web-design', 'Web design'),
('Figma', 'figma', 'Figma design tool'),
('Adobe XD', 'adobe-xd', 'Adobe XD design tool'),
('Photoshop', 'photoshop', 'Adobe Photoshop'),
('Illustrator', 'illustrator', 'Adobe Illustrator'),

-- Business & Marketing
('Digital Marketing', 'digital-marketing', 'Digital marketing strategies'),
('SEO', 'seo', 'Search Engine Optimization'),
('Social Media Marketing', 'social-media-marketing', 'Social media marketing'),
('Content Marketing', 'content-marketing', 'Content marketing'),
('Email Marketing', 'email-marketing', 'Email marketing'),
('Business Strategy', 'business-strategy', 'Business strategy and planning'),
('Entrepreneurship', 'entrepreneurship', 'Starting and running a business'),
('Project Management', 'project-management', 'Project management'),

-- Other Skills
('Communication', 'communication', 'Communication skills'),
('Leadership', 'leadership', 'Leadership and management'),
('Productivity', 'productivity', 'Productivity and time management'),
('Career Development', 'career-development', 'Career growth and development'),
('Freelancing', 'freelancing', 'Freelancing and remote work'),
('Blockchain', 'blockchain', 'Blockchain technology'),
('Cybersecurity', 'cybersecurity', 'Cybersecurity and security'),
('Game Development', 'game-development', 'Video game development'),
('Testing', 'testing', 'Software testing and QA'),
('API Development', 'api-development', 'API design and development')

ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================================
-- 5. CREATE HELPER VIEWS (OPTIONAL)
-- ============================================================================

-- View for courses with their tags (useful for reporting)
CREATE OR REPLACE VIEW course_tags_view AS
SELECT 
    c.id AS course_id,
    c.title AS course_title,
    GROUP_CONCAT(ct.name ORDER BY ct.name SEPARATOR ', ') AS tags,
    COUNT(ctr.tag_id) AS tag_count
FROM courses c
LEFT JOIN course_tag_relations ctr ON c.id = ctr.course_id
LEFT JOIN course_tags ct ON ctr.tag_id = ct.id
GROUP BY c.id, c.title;

-- ============================================================================
-- 6. MIGRATION VERIFICATION
-- ============================================================================

-- Check FULLTEXT indexes
SHOW INDEX FROM courses WHERE Index_type = 'FULLTEXT';

-- Check composite indexes
SHOW INDEX FROM courses WHERE Key_name LIKE 'idx_%';

-- Check tag tables
SELECT COUNT(*) AS total_tags FROM course_tags;

-- ============================================================================
-- ROLLBACK SCRIPT (for reference - run manually if needed)
-- ============================================================================

/*
-- To rollback this migration:

-- Drop indexes
ALTER TABLE courses DROP INDEX idx_fulltext_search;
ALTER TABLE courses DROP INDEX idx_fulltext_title;
ALTER TABLE courses DROP INDEX idx_published_category_difficulty;
ALTER TABLE courses DROP INDEX idx_rating_review_count;
ALTER TABLE courses DROP INDEX idx_published_rating;
ALTER TABLE courses DROP INDEX idx_published_price;
ALTER TABLE courses DROP INDEX idx_published_duration;

-- Drop view
DROP VIEW IF EXISTS course_tags_view;

-- Drop tables (careful - will lose data!)
DROP TABLE IF EXISTS course_tag_relations;
DROP TABLE IF EXISTS course_tags;
*/
