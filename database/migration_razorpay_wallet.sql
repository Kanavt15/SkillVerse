-- Razorpay Wallet System Migration
-- Date: 2026-04-05
-- Description: Add wallet system with Razorpay payment integration

USE skillverse;

-- ============================================================================
-- 1. POINT PACKAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS point_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    points INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    bonus_points INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. WALLETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    balance INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_balance (balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. WALLET TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    transaction_type ENUM('credit', 'debit') NOT NULL,
    amount INT NOT NULL,
    balance_before INT NOT NULL,
    balance_after INT NOT NULL,
    source ENUM('purchase', 'enrollment', 'refund', 'admin_adjustment', 'reward') NOT NULL,
    status ENUM('pending', 'success', 'failed', 'cancelled') DEFAULT 'pending',
    reference_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255) UNIQUE,
    razorpay_signature VARCHAR(500),
    package_id INT,
    course_id INT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (package_id) REFERENCES point_packages(id) ON DELETE SET NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_status (status),
    INDEX idx_source (source),
    INDEX idx_razorpay_order_id (razorpay_order_id),
    INDEX idx_razorpay_payment_id (razorpay_payment_id),
    INDEX idx_created_at (created_at),
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. POPULATE POINT PACKAGES
-- ============================================================================
INSERT INTO point_packages (name, points, price, bonus_points, display_order, is_active) VALUES
('Starter Pack', 100, 99.00, 0, 1, TRUE),
('Popular Pack', 500, 449.00, 50, 2, TRUE),
('Premium Pack', 1000, 849.00, 150, 3, TRUE),
('Ultimate Pack', 2500, 1999.00, 500, 4, TRUE),
('Mega Pack', 5000, 3799.00, 1200, 5, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================================
-- 5. CREATE TRIGGER FOR WALLET AUTO-CREATION
-- ============================================================================
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS create_wallet_for_new_user
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO wallets (user_id, balance)
    VALUES (NEW.id, 0)
    ON DUPLICATE KEY UPDATE user_id=user_id;
END$$

DELIMITER ;

-- ============================================================================
-- 6. CREATE WALLETS FOR EXISTING USERS
-- ============================================================================
INSERT INTO wallets (user_id, balance)
SELECT id, 0
FROM users
WHERE id NOT IN (SELECT user_id FROM wallets)
ON DUPLICATE KEY UPDATE user_id=user_id;

-- ============================================================================
-- 7. ADD INDEXES TO EXISTING TABLES (IF NOT EXISTS)
-- ============================================================================

-- Add index to enrollments for wallet queries
ALTER TABLE enrollments 
ADD INDEX IF NOT EXISTS idx_user_course (user_id, course_id);

-- ============================================================================
-- 8. VERIFICATION QUERIES
-- ============================================================================

-- Check point packages
SELECT COUNT(*) as package_count FROM point_packages WHERE is_active = TRUE;

-- Check wallets created
SELECT COUNT(*) as wallet_count FROM wallets;

-- Check indexes
SHOW INDEX FROM wallets;
SHOW INDEX FROM wallet_transactions;

-- ============================================================================
-- ROLLBACK SCRIPT (for reference - run manually if needed)
-- ============================================================================

/*
-- To rollback this migration:

-- Drop trigger
DROP TRIGGER IF EXISTS create_wallet_for_new_user;

-- Drop tables (careful - will lose data!)
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS point_packages;
*/
