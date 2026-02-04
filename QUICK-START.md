# 🚀 SkillVerse Quick Start Guide

Get SkillVerse up and running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js (v18+) installed
- [ ] MySQL (v8.0+) installed and running
- [ ] Git installed
- [ ] Code editor (VS Code recommended)

## Step-by-Step Setup

### 1️⃣ Database Setup (2 minutes)

Open MySQL command line or MySQL Workbench:

```bash
# Login to MySQL
mysql -u root -p

# Run the schema
source E:/Kanav/Projects/SkillVerse/database/schema.sql
```

Or manually:
```sql
CREATE DATABASE skillverse;
USE skillverse;                                                                             
-- Copy and paste content from database/schema.sql
```

Verify installation:
```sql
SHOW TABLES;
-- Should show: users, courses, lessons, enrollments, etc.
```

### 2️⃣ Backend Setup (1 minute)

```bash
# Navigate to backend folder
cd E:/Kanav/Projects/SkillVerse/backend

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env file with your MySQL credentials
# DB_PASSWORD=your_mysql_password
# JWT_SECRET=any_random_secret_string

# Start the server
npm run dev
```

✅ Backend running at: http://localhost:5000

Test it:
```bash
curl http://localhost:5000/api/health
```

### 3️⃣ Frontend Setup (1 minute)

Open a new terminal:

```bash
# Navigate to frontend folder
cd E:/Kanav/Projects/SkillVerse/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

✅ Frontend running at: http://localhost:3000

### 4️⃣ Test the Application (1 minute)

1. Open browser: http://localhost:3000
2. Click "Sign Up"
3. Create an account:
   - Email: test@example.com
   - Password: password123
   - Full Name: Test User
   - Role: Both (to access all features)
4. Login with your credentials
5. Explore the platform!

## 🎯 What to Try First

### As a Learner:
1. Browse courses: Click "Browse Courses"
2. View course details
3. Enroll in a free course
4. Go to "My Courses" to see your enrollment

### As an Instructor:
1. Click "Teach" in the navbar
2. Create a new course
3. Add course details (title, description, category)
4. Add lessons to your course
5. Publish your course

## 🔧 Common Issues & Solutions

### Issue: MySQL Connection Failed

**Solution:**
```bash
# Check if MySQL is running
# Windows:
services.msc (look for MySQL service)

# Start MySQL if stopped
net start MySQL80

# Verify credentials in backend/.env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=skillverse
```

### Issue: Port Already in Use

**Backend (Port 5000):**
```bash
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Change port in backend/.env
PORT=5001
```

**Frontend (Port 3000):**
```bash
# Change port in frontend/vite.config.js
server: {
  port: 3001
}
```

### Issue: npm install fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Issue: CORS errors

**Solution:**
Check `backend/.env`:
```env
CLIENT_URL=http://localhost:3000
```

Check `backend/server.js` has CORS enabled:
```javascript
app.use(cors({
  origin: process.env.CLIENT_URL
}));
```

## 📊 Database Seed Data (Optional)

Want some test data? Run this in MySQL:

```sql
USE skillverse;

-- Sample instructor account
INSERT INTO users (email, password, full_name, role) 
VALUES ('instructor@test.com', '$2a$10$...bcrypt_hash', 'Jane Instructor', 'instructor');

-- Sample course (adjust instructor_id)
INSERT INTO courses (instructor_id, category_id, title, description, difficulty_level, is_published) 
VALUES (1, 1, 'Web Development Basics', 'Learn HTML, CSS, and JavaScript', 'beginner', true);

-- Sample lesson (adjust course_id)
INSERT INTO lessons (course_id, title, description, lesson_order, duration_minutes, is_free) 
VALUES (1, 'Introduction to HTML', 'Learn HTML fundamentals', 1, 30, true);
```

## 🧪 Testing the API

### Using curl:

**Health Check:**
```bash
curl http://localhost:5000/api/health
```

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\",\"full_name\":\"Test User\",\"role\":\"learner\"}"
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

**Get Courses:**
```bash
curl http://localhost:5000/api/courses
```

### Using Postman:

Import this collection:
1. Open Postman
2. Import → Raw Text
3. Use the API documentation from `API-Documentation.md`

## 📱 Accessing from Mobile/Other Devices

To access from other devices on your network:

1. Find your IP address:
```bash
# Windows
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.100)
```

2. Update backend `.env`:
```env
CLIENT_URL=http://192.168.1.100:3000
```

3. Update frontend API calls:
```env
VITE_API_URL=http://192.168.1.100:5000/api
```

4. Access from mobile:
- Frontend: http://192.168.1.100:3000
- Backend: http://192.168.1.100:5000

## 🎨 Customization

### Change Theme Colors:

Edit `frontend/src/index.css`:
```css
:root {
  --primary: 221.2 83.2% 53.3%; /* Change this */
}
```

### Change Logo:

Edit `frontend/src/components/Navbar.jsx`:
```javascript
<BookOpen className="h-8 w-8 text-primary" /> // Replace with your logo
```

## 📚 Next Steps

1. **Read the docs:**
   - [README.md](README.md) - Full documentation
   - [API-Documentation.md](API-Documentation.md) - API reference
   - [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture

2. **Explore the code:**
   - Frontend: `frontend/src/pages/`
   - Backend: `backend/controllers/`
   - Database: `database/schema.sql`

3. **Add features:**
   - File uploads for course thumbnails
   - Video streaming integration
   - Payment processing
   - Course reviews and ratings

4. **Deploy:**
   - Frontend: Vercel, Netlify
   - Backend: AWS, DigitalOcean, Heroku
   - Database: AWS RDS, PlanetScale

## 🆘 Need Help?

- **Documentation:** Check README.md
- **API Reference:** See API-Documentation.md
- **Architecture:** Read ARCHITECTURE.md
- **Database:** Review database/schema.sql

## ✅ Success Checklist

- [ ] MySQL database created and populated
- [ ] Backend server running on port 5000
- [ ] Frontend app running on port 3000
- [ ] Can access http://localhost:3000 in browser
- [ ] Can register a new user account
- [ ] Can login successfully
- [ ] Can browse courses
- [ ] Can create a course (as instructor)
- [ ] Can enroll in a course (as learner)

**Congratulations! 🎉 SkillVerse is now running!**

Happy learning and teaching! 🚀
