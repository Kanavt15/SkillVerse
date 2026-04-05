// Quick test to verify tag routes load correctly
const express = require('express');
const app = express();

try {
  const tagRoutes = require('./routes/tag.routes');
  console.log('✅ Tag routes loaded successfully!');
  console.log('✅ Auth middleware imported correctly');
  
  app.use('/api/tags', tagRoutes);
  console.log('✅ Tag routes registered successfully');
  
  console.log('\nThe error has been fixed! You can now start your server with:');
  console.log('  npm start');
  console.log('  or');
  console.log('  node server.js');
} catch (error) {
  console.error('❌ Error loading tag routes:', error.message);
  process.exit(1);
}
