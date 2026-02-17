// Quick script to create the point_transactions table if it doesn't exist
// Run: node create_point_transactions.js

require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'skillverse',
        port: process.env.DB_PORT || 3306
    });

    console.log('Connected to database.');

    // Create point_transactions table
    await connection.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✅ point_transactions table created (or already exists).');

    // Update points_cost for courses
    await connection.execute(`
    UPDATE courses SET points_cost = CASE
      WHEN price = 0 THEN 0
      WHEN price * 10 < 50 THEN 50
      ELSE ROUND(price * 10)
    END
    WHERE points_cost IS NULL OR points_cost = 50
  `);
    console.log('✅ courses points_cost updated.');

    // Update points_reward for courses
    await connection.execute(`
    UPDATE courses SET points_reward = CASE
      WHEN difficulty_level = 'beginner' THEN 75
      WHEN difficulty_level = 'intermediate' THEN 150
      WHEN difficulty_level = 'advanced' THEN 300
      ELSE 75
    END
    WHERE points_reward IS NULL OR points_reward = 75
  `);
    console.log('✅ courses points_reward updated.');

    // Insert welcome bonus for users who don't have one yet
    const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM point_transactions'
    );
    if (existing[0].count === 0) {
        await connection.execute(`
      INSERT INTO point_transactions (user_id, amount, type, description)
      SELECT id, 500, 'bonus', 'Welcome bonus - initial points'
      FROM users
    `);
        console.log('✅ Welcome bonus transactions inserted for all users.');
    } else {
        console.log('ℹ️  point_transactions already has data, skipping welcome bonus insert.');
    }

    await connection.end();
    console.log('Done! You can now restart the server.');
}

run().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
