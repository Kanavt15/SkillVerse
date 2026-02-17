-- SkillVerse Points System Migration
-- Run this migration against your existing database

USE skillverse;

-- 1. Add points column to users table (default 500 for new users)
ALTER TABLE users ADD COLUMN points INT DEFAULT 500 AFTER profile_image;

-- 2. Add points_cost and points_reward columns to courses table
ALTER TABLE courses ADD COLUMN points_cost INT DEFAULT 50 AFTER price;
ALTER TABLE courses ADD COLUMN points_reward INT DEFAULT 75 AFTER points_cost;

-- Temporarily disable safe update mode for bulk updates
SET SQL_SAFE_UPDATES = 0;

-- 3. Migrate existing price data to points_cost
-- (price * 10, minimum 50; if price is 0, points_cost = 0 for free courses)
UPDATE courses SET points_cost = CASE
    WHEN price = 0 THEN 0
    WHEN price * 10 < 50 THEN 50
    ELSE ROUND(price * 10)
END
WHERE id > 0;

-- 4. Set points_reward based on difficulty_level
UPDATE courses SET points_reward = CASE
    WHEN difficulty_level = 'beginner' THEN 75
    WHEN difficulty_level = 'intermediate' THEN 150
    WHEN difficulty_level = 'advanced' THEN 300
    ELSE 75
END
WHERE id > 0;

-- Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;

-- 5. Create point_transactions table for tracking history
CREATE TABLE IF NOT EXISTS point_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    type ENUM('earned', 'spent', 'bonus') NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Insert welcome bonus transactions for existing users
INSERT INTO point_transactions (user_id, amount, type, description)
SELECT id, 500, 'bonus', 'Welcome bonus - initial points'
FROM users;

-- 7. Drop the old price column (optional - uncomment when ready)
-- ALTER TABLE courses DROP COLUMN price;
