-- ============================
-- Migration: Learning Streak & Badge System
-- SkillVerse Gamification Feature
-- ============================

USE skillverse;

-- ============================
-- 1. Add gamification columns to users table
-- ============================
ALTER TABLE users
ADD COLUMN xp INT DEFAULT 0 AFTER points,
ADD COLUMN level INT DEFAULT 1 AFTER xp,
ADD COLUMN current_streak INT DEFAULT 0 AFTER level,
ADD COLUMN longest_streak INT DEFAULT 0 AFTER current_streak,
ADD COLUMN streak_last_activity_date DATE DEFAULT NULL AFTER longest_streak,
ADD COLUMN streak_freeze_count INT DEFAULT 0 AFTER streak_last_activity_date,
ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC' AFTER streak_freeze_count;

-- Add indexes for leaderboard queries
ALTER TABLE users ADD INDEX idx_xp (xp DESC);
ALTER TABLE users ADD INDEX idx_level (level DESC);
ALTER TABLE users ADD INDEX idx_streak (current_streak DESC);

-- ============================
-- 2. XP Transactions Table
-- ============================
CREATE TABLE IF NOT EXISTS xp_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    event_type ENUM(
        'lesson_complete',
        'course_complete',
        'first_lesson_daily',
        'streak_bonus',
        'badge_earned',
        'quiz_complete',
        'discussion_post',
        'discussion_helpful',
        'review_posted',
        'milestone_bonus'
    ) NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference_id INT DEFAULT NULL,
    reference_type ENUM('lesson', 'course', 'badge', 'discussion', 'review') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created (created_at),
    INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================
-- 3. Daily Activity Log (for streak calculation)
-- ============================
CREATE TABLE IF NOT EXISTS daily_activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_date DATE NOT NULL,
    lessons_completed INT DEFAULT 0,
    time_spent_minutes INT DEFAULT 0,
    xp_earned INT DEFAULT 0,
    streak_maintained BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, activity_date),
    INDEX idx_user (user_id),
    INDEX idx_activity_date (activity_date),
    INDEX idx_user_date_desc (user_id, activity_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================
-- 4. Badge Definitions Table
-- ============================
CREATE TABLE IF NOT EXISTS badge_definitions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    category ENUM(
        'streak',
        'completion',
        'engagement',
        'mastery',
        'social',
        'special'
    ) NOT NULL,
    tier ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond') DEFAULT 'bronze',
    xp_reward INT DEFAULT 0,
    criteria_type ENUM(
        'streak_days',
        'courses_completed',
        'lessons_completed',
        'total_xp',
        'level_reached',
        'time_spent_hours',
        'reviews_posted',
        'discussions_posted',
        'helpful_answers',
        'certificates_earned',
        'categories_explored',
        'perfect_course',
        'early_bird',
        'night_owl',
        'weekend_warrior',
        'custom'
    ) NOT NULL,
    criteria_value INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_tier (tier),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================
-- 5. User Badges Table (earned badges)
-- ============================
CREATE TABLE IF NOT EXISTS user_badges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    badge_id INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_featured BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_badge (user_id, badge_id),
    INDEX idx_user (user_id),
    INDEX idx_badge (badge_id),
    INDEX idx_user_earned (user_id, earned_at DESC),
    INDEX idx_featured (user_id, is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================
-- 6. Streak Freezes Table
-- ============================
CREATE TABLE IF NOT EXISTS streak_freezes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    freeze_date DATE NOT NULL,
    reason ENUM('purchased', 'earned', 'bonus') DEFAULT 'purchased',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_freeze_date (freeze_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================
-- 7. Activity Audit Log (anti-cheat)
-- ============================
CREATE TABLE IF NOT EXISTS activity_audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    session_id VARCHAR(100),
    metadata JSON,
    is_suspicious BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_action (action_type),
    INDEX idx_created (created_at),
    INDEX idx_suspicious (is_suspicious, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================
-- 8. Update notifications table ENUM
-- ============================
ALTER TABLE notifications MODIFY COLUMN type
ENUM('enrollment', 'new_lesson', 'certificate', 'follower', 'badge_earned', 'level_up', 'streak_milestone', 'streak_at_risk') NOT NULL;

-- ============================
-- 9. Insert default badge definitions
-- ============================
INSERT INTO badge_definitions (slug, name, description, icon, category, tier, xp_reward, criteria_type, criteria_value) VALUES
-- Streak Badges
('streak_3', 'Getting Started', '3-day learning streak', 'flame', 'streak', 'bronze', 25, 'streak_days', 3),
('streak_7', 'Week Warrior', '7-day learning streak', 'flame', 'streak', 'bronze', 50, 'streak_days', 7),
('streak_14', 'Fortnight Fighter', '14-day learning streak', 'flame', 'streak', 'silver', 100, 'streak_days', 14),
('streak_30', 'Monthly Master', '30-day learning streak', 'flame', 'streak', 'gold', 250, 'streak_days', 30),
('streak_60', 'Dedication', '60-day learning streak', 'flame', 'streak', 'platinum', 500, 'streak_days', 60),
('streak_100', 'Centurion', '100-day learning streak', 'flame', 'streak', 'diamond', 1000, 'streak_days', 100),
('streak_365', 'Year of Learning', '365-day learning streak', 'crown', 'streak', 'diamond', 5000, 'streak_days', 365),

-- Completion Badges - Lessons
('first_lesson', 'First Steps', 'Complete your first lesson', 'book-open', 'completion', 'bronze', 10, 'lessons_completed', 1),
('lessons_10', 'Eager Learner', 'Complete 10 lessons', 'book-open', 'completion', 'bronze', 50, 'lessons_completed', 10),
('lessons_50', 'Knowledge Seeker', 'Complete 50 lessons', 'book-open', 'completion', 'silver', 150, 'lessons_completed', 50),
('lessons_100', 'Lesson Legend', 'Complete 100 lessons', 'book-open', 'completion', 'gold', 300, 'lessons_completed', 100),
('lessons_500', 'Learning Machine', 'Complete 500 lessons', 'book-open', 'completion', 'diamond', 1000, 'lessons_completed', 500),

-- Completion Badges - Courses
('first_course', 'Graduate', 'Complete your first course', 'graduation-cap', 'completion', 'bronze', 100, 'courses_completed', 1),
('courses_5', 'Multi-skilled', 'Complete 5 courses', 'graduation-cap', 'completion', 'silver', 300, 'courses_completed', 5),
('courses_10', 'Polymath', 'Complete 10 courses', 'graduation-cap', 'completion', 'gold', 500, 'courses_completed', 10),
('courses_25', 'Renaissance Mind', 'Complete 25 courses', 'graduation-cap', 'completion', 'platinum', 1000, 'courses_completed', 25),

-- Mastery Badges - Levels
('level_5', 'Rising Star', 'Reach level 5', 'star', 'mastery', 'bronze', 50, 'level_reached', 5),
('level_10', 'Apprentice', 'Reach level 10', 'star', 'mastery', 'silver', 100, 'level_reached', 10),
('level_25', 'Expert', 'Reach level 25', 'star', 'mastery', 'gold', 250, 'level_reached', 25),
('level_50', 'Master', 'Reach level 50', 'star', 'mastery', 'platinum', 500, 'level_reached', 50),
('level_100', 'Grand Master', 'Reach level 100', 'crown', 'mastery', 'diamond', 1000, 'level_reached', 100),

-- Mastery Badges - XP
('xp_1000', 'XP Collector', 'Earn 1,000 XP', 'zap', 'mastery', 'bronze', 50, 'total_xp', 1000),
('xp_10000', 'XP Hunter', 'Earn 10,000 XP', 'zap', 'mastery', 'silver', 200, 'total_xp', 10000),
('xp_50000', 'XP Legend', 'Earn 50,000 XP', 'zap', 'mastery', 'gold', 500, 'total_xp', 50000),

-- Social/Engagement Badges
('first_review', 'Critic', 'Post your first review', 'message-square', 'social', 'bronze', 25, 'reviews_posted', 1),
('reviews_10', 'Reviewer', 'Post 10 reviews', 'message-square', 'social', 'silver', 100, 'reviews_posted', 10),
('first_discussion', 'Conversationalist', 'Post in a discussion', 'message-circle', 'social', 'bronze', 25, 'discussions_posted', 1),
('helpful_5', 'Helper', 'Get 5 helpful votes on answers', 'heart', 'social', 'silver', 100, 'helpful_answers', 5),
('helpful_25', 'Community Star', 'Get 25 helpful votes on answers', 'heart', 'social', 'gold', 250, 'helpful_answers', 25),

-- Special Badges
('early_bird', 'Early Bird', 'Complete a lesson before 8 AM', 'sunrise', 'special', 'bronze', 25, 'early_bird', 1),
('night_owl', 'Night Owl', 'Complete a lesson after 10 PM', 'moon', 'special', 'bronze', 25, 'night_owl', 1),
('weekend_warrior', 'Weekend Warrior', 'Learn on 4 consecutive weekends', 'calendar', 'special', 'silver', 100, 'weekend_warrior', 4),
('categories_3', 'Explorer', 'Complete courses in 3 different categories', 'compass', 'special', 'silver', 150, 'categories_explored', 3),
('certificates_5', 'Certified Pro', 'Earn 5 certificates', 'award', 'completion', 'gold', 300, 'certificates_earned', 5);
