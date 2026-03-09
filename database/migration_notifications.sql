-- SkillVerse Notification System Migration
-- Adds notifications and followers tables

USE skillverse;

-- Notifications Table
-- Stores in-app notifications for users
CREATE TABLE IF NOT EXISTS notifications (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    user_id       INT NOT NULL,
    type          ENUM('enrollment','new_lesson','certificate','follower') NOT NULL,
    title         VARCHAR(255) NOT NULL,
    message       TEXT NOT NULL,
    reference_id  INT DEFAULT NULL,
    is_read       BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read    (user_id, is_read),
    INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Followers Table
-- Tracks user follow relationships (learner follows instructor)
CREATE TABLE IF NOT EXISTS followers (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    follower_id   INT NOT NULL,
    following_id  INT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_follow (follower_id, following_id),
    INDEX idx_follower  (follower_id),
    INDEX idx_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
