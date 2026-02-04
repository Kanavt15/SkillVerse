# SkillVerse API Routes Reference

## Backend API Routes (Base URL: http://localhost:5000/api)

### Authentication Routes (`/api/auth`)
- **POST** `/auth/register` - Register new user
- **POST** `/auth/login` - Login user
- **GET** `/auth/me` - Get current user (Protected)

### User Routes (`/api/users`)
- **GET** `/users/profile` - Get user profile (Protected)
- **PUT** `/users/profile` - Update user profile (Protected)

### Course Routes (`/api/courses`)
- **GET** `/courses` - Get all published courses (Public)
- **GET** `/courses/instructor` - Get instructor's courses (Protected, Instructor)
- **GET** `/courses/:id` - Get single course details (Public)
- **POST** `/courses` - Create new course (Protected, Instructor, with thumbnail upload)
- **PUT** `/courses/:id` - Update course (Protected, Instructor, with thumbnail upload)
- **DELETE** `/courses/:id` - Delete course (Protected, Instructor)
- **POST** `/courses/:id/lessons` - Create lesson for course (Protected, Instructor, with video upload)

### Lesson Routes (`/api/lessons`)
- **GET** `/lessons/course/:courseId` - Get all lessons for a course (Public)
- **GET** `/lessons/:id` - Get single lesson details (Public)
- **POST** `/lessons` - Create new lesson (Protected, Instructor, with video upload)
- **PUT** `/lessons/:id` - Update lesson (Protected, Instructor, with video upload)
- **DELETE** `/lessons/:id` - Delete lesson (Protected, Instructor)

### Enrollment Routes (`/api/enrollments`)
- **GET** `/enrollments` - Get user's enrollments (Protected)
- **POST** `/enrollments` - Enroll in a course (Protected)
- **GET** `/enrollments/:id/progress` - Get enrollment progress (Protected)
- **POST** `/enrollments/:id/progress` - Update lesson progress (Protected)

### Category Routes (`/api/categories`)
- **GET** `/categories` - Get all categories (Public)

## Frontend Routes

### Public Routes
- `/` - Home page
- `/login` - Login page
- `/register` - Registration page
- `/courses` - Browse all courses
- `/courses/:id` - Course detail page

### Protected Routes (Learner)
- `/my-courses` - User's enrolled courses
- `/my-courses/:id` - Course learning interface

### Protected Routes (Instructor)
- `/instructor/dashboard` - Instructor dashboard
- `/instructor/courses/create` - Create new course
- `/instructor/courses/:id/edit` - Edit course & manage lessons
- `/instructor/courses/:id/lessons/create` - Create new lesson
- `/instructor/courses/:id/lessons/:lessonId/edit` - Edit lesson

## File Upload Endpoints

### Thumbnail Upload (Courses)
- **Endpoint**: POST `/api/courses` or PUT `/api/courses/:id`
- **Field Name**: `thumbnail`
- **Accepted Types**: JPEG, PNG, GIF, WEBP
- **Max Size**: 5MB
- **Storage**: `/backend/uploads/thumbnails/`

### Video Upload (Lessons)
- **Endpoint**: POST `/api/courses/:id/lessons`, POST `/api/lessons`, or PUT `/api/lessons/:id`
- **Field Name**: `video`
- **Accepted Types**: MP4, AVI, MOV, WMV, FLV, MKV
- **Max Size**: 500MB
- **Storage**: `/backend/uploads/videos/`

## Authentication

All protected routes require JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

The token is automatically included by the axios interceptor in `frontend/src/lib/api.js`.

## Common Issues & Solutions

### Login Issues
1. **Check Backend Server**: Ensure backend is running on port 5000
2. **Check Database**: Verify database connection in backend logs
3. **Check JWT Secret**: Ensure JWT_SECRET is set in backend/.env
4. **Clear Browser Storage**: Clear localStorage if you see authentication issues

### Course Creation Issues
1. **Category Selection**: Ensure a category is selected before submitting
2. **Thumbnail Upload**: File must be under 5MB and valid image format
3. **Check Backend Logs**: Look for validation errors in terminal

### Lesson Creation Issues
1. **Description Field**: Now required field, provide a short description
2. **Video Upload**: File must be under 500MB for uploaded videos
3. **Boolean Conversion**: is_free checkbox is properly converted to 0/1
4. **Route Usage**: Uses POST `/api/courses/:id/lessons` (nested route)

### Lesson Display Issues
1. **Fetch Route**: Use GET `/api/lessons/course/:id` (not `/courses/:id/lessons`)
2. **Refresh After Creation**: Refresh course edit page to see new lessons
3. **Check Enrollment**: Ensure you're enrolled to access CourseLearn page

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=skillverse
DB_PORT=3306
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```
