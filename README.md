# 🎓 SkillVerse - Modern Skill-Sharing Platform

A full-stack web application where users can both teach and learn skills. Built with React, Node.js, Express, and MySQL.

![Tech Stack](https://img.shields.io/badge/React-18.2-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.18-lightgrey)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Security](#security)
- [Future Enhancements](#future-enhancements)

## ✨ Features

### Core Features

- **🔐 Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Learner, Instructor, Both)
  - Secure password hashing with bcrypt
  - Protected routes on frontend and backend

- **📚 Course Management**
  - Create, update, delete courses (Instructors)
  - Upload video lessons and organize content
  - Categorize courses by skill domain
  - Set difficulty levels (Beginner, Intermediate, Advanced)
  - Publish/unpublish courses
  - Free and paid course options

- **🎯 Learning Experience**
  - Browse and search courses
  - Filter by category and difficulty level
  - Enroll in courses
  - Track progress per lesson
  - "My Courses" dashboard
  - Course completion tracking

- **👨‍🏫 Instructor Dashboard**
  - View all created courses
  - Track student enrollments
  - Manage course content
  - Analytics overview

## 🛠️ Tech Stack

### Frontend
- **React 18.2** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Reusable component library
- **Axios** - HTTP client
- **Lucide React** - Icon library

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL 2** - Database driver
- **JWT** - Token-based authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting

### Database
- **MySQL 8.0+** - Relational database
- Normalized schema design
- Efficient indexing for performance

## 🏗️ Architecture

### System Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   React     │ HTTP    │   Express   │  MySQL  │   MySQL     │
│   Frontend  │◄───────►│   Backend   │◄───────►│   Database  │
│  (Port 3000)│         │  (Port 5000)│         │  (Port 3306)│
└─────────────┘         └─────────────┘         └─────────────┘
```

### Frontend Architecture

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn/ui components
│   ├── Navbar.jsx    # Navigation bar
│   └── ProtectedRoute.jsx
├── pages/            # Route components
├── context/          # React Context (Auth)
├── lib/              # Utilities (API, helpers)
└── App.jsx           # Main app component
```

### Backend Architecture

```
backend/
├── config/           # Configuration files
│   └── database.js   # Database connection
├── controllers/      # Business logic
├── middleware/       # Custom middleware
├── routes/           # API routes
└── server.js         # App entry point
```

### API Architecture

RESTful API design with the following patterns:
- Resource-based URLs
- HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response format
- JWT bearer token authentication
- Consistent error handling

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **MySQL** (v8.0 or higher)
- **npm** or **yarn**

### Installation

#### 1. Clone the repository

```bash
git clone <repository-url>
cd SkillVerse
```

#### 2. Set up the Database

```bash
# Login to MySQL
mysql -u root -p

# Run the schema file
mysql -u root -p < database/schema.sql
```

Or manually:
```sql
source database/schema.sql;
```

#### 3. Set up Backend

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=skillverse
# JWT_SECRET=your_secret_key
```

Start the backend server:
```bash
npm run dev
```

The backend will run on http://localhost:5000

#### 4. Set up Frontend

```bash
cd frontend
npm install

# Create .env file (optional)
cp .env.example .env
```

Start the frontend:
```bash
npm run dev
```

The frontend will run on http://localhost:3000

### Environment Variables

#### Backend (.env)
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=skillverse
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d

CLIENT_URL=http://localhost:3000
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "learner" // or "instructor" or "both"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "jwt_token_here",
  "user": { ... }
}
```

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "John Updated",
  "bio": "Software developer",
  "role": "both"
}
```

### Course Endpoints

#### Get All Courses
```http
GET /courses?search=web&category_id=1&difficulty_level=beginner
```

#### Get Single Course
```http
GET /courses/:id
```

#### Create Course (Instructor Only)
```http
POST /courses
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Web Development Bootcamp",
  "description": "Learn full-stack web development",
  "category_id": 1,
  "difficulty_level": "beginner",
  "price": 0
}
```

#### Update Course (Owner Only)
```http
PUT /courses/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "is_published": true
}
```

#### Delete Course (Owner Only)
```http
DELETE /courses/:id
Authorization: Bearer <token>
```

#### Get Instructor's Courses
```http
GET /courses/instructor
Authorization: Bearer <token>
```

### Lesson Endpoints

#### Create Lesson (Instructor Only)
```http
POST /lessons
Authorization: Bearer <token>
Content-Type: application/json

{
  "course_id": 1,
  "title": "Introduction to HTML",
  "description": "Learn HTML basics",
  "lesson_order": 1,
  "video_url": "https://example.com/video.mp4",
  "duration_minutes": 30,
  "content": "Lesson content here",
  "is_free": false
}
```

#### Get Course Lessons
```http
GET /lessons/course/:courseId
```

#### Update Lesson (Owner Only)
```http
PUT /lessons/:id
Authorization: Bearer <token>
```

#### Delete Lesson (Owner Only)
```http
DELETE /lessons/:id
Authorization: Bearer <token>
```

### Enrollment Endpoints

#### Enroll in Course
```http
POST /enrollments
Authorization: Bearer <token>
Content-Type: application/json

{
  "course_id": 1
}
```

#### Get Enrolled Courses
```http
GET /enrollments
Authorization: Bearer <token>
```

#### Get Course Progress
```http
GET /enrollments/course/:courseId
Authorization: Bearer <token>
```

#### Mark Lesson Complete
```http
PUT /enrollments/lesson/:lessonId/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "time_spent_minutes": 30
}
```

#### Update Lesson Progress
```http
PUT /enrollments/lesson/:lessonId/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "time_spent_minutes": 15
}
```

### Category Endpoints

#### Get All Categories
```http
GET /categories
```

### Response Format

#### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ] // Optional validation errors
}
```

## 🗄️ Database Schema

See [database/ER-Diagram.md](database/ER-Diagram.md) for detailed entity-relationship diagram.

### Main Tables

1. **users** - User accounts and profiles
2. **categories** - Course categories
3. **courses** - Course information
4. **lessons** - Individual lessons within courses
5. **lesson_resources** - Downloadable materials (PDFs, notes)
6. **enrollments** - User course enrollments
7. **lesson_progress** - Lesson completion tracking
8. **reviews** - Course reviews (optional)

### Key Relationships

- One instructor can create many courses
- One course belongs to one category
- One course has many lessons
- One lesson can have many resources
- One user can enroll in many courses
- One enrollment tracks progress for many lessons

## 📁 Project Structure

```
SkillVerse/
│
├── backend/                # Backend API
│   ├── config/            # Configuration files
│   │   └── database.js    # Database connection
│   ├── controllers/       # Business logic
│   │   ├── auth.controller.js
│   │   ├── course.controller.js
│   │   ├── lesson.controller.js
│   │   ├── enrollment.controller.js
│   │   └── category.controller.js
│   ├── middleware/        # Custom middleware
│   │   └── auth.middleware.js
│   ├── routes/           # API routes
│   │   ├── auth.routes.js
│   │   ├── course.routes.js
│   │   ├── lesson.routes.js
│   │   ├── enrollment.routes.js
│   │   ├── category.routes.js
│   │   └── user.routes.js
│   ├── .env.example      # Environment variables template
│   ├── .gitignore
│   ├── package.json
│   └── server.js         # Entry point
│
├── frontend/             # React frontend
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   │   ├── ui/      # shadcn/ui components
│   │   │   ├── Navbar.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/     # React Context
│   │   │   └── AuthContext.jsx
│   │   ├── lib/         # Utilities
│   │   │   ├── api.js
│   │   │   └── utils.js
│   │   ├── pages/       # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Courses.jsx
│   │   │   ├── CourseDetail.jsx
│   │   │   ├── MyCourses.jsx
│   │   │   ├── InstructorDashboard.jsx
│   │   │   └── CreateCourse.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── jsconfig.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── database/            # Database files
│   ├── schema.sql       # Database schema
│   └── ER-Diagram.md    # Entity-relationship diagram
│
└── README.md           # This file
```

## 🔒 Security

### Implemented Security Features

1. **Password Security**
   - Passwords hashed with bcrypt (10 salt rounds)
   - Never stored or transmitted in plain text

2. **JWT Authentication**
   - Stateless authentication
   - Token expiration (7 days default)
   - Bearer token authorization

3. **Input Validation**
   - express-validator for request validation
   - SQL injection prevention via parameterized queries
   - XSS protection

4. **HTTP Security**
   - Helmet.js for security headers
   - CORS configuration
   - Rate limiting (100 requests per 15 minutes)

5. **Authorization**
   - Role-based access control
   - Resource ownership verification
   - Protected routes on frontend and backend

### Best Practices

- Always use HTTPS in production
- Keep dependencies updated
- Use environment variables for secrets
- Implement proper error handling
- Log security events
- Regular security audits

## 🎯 Future Enhancements

### Planned Features

- [ ] **Course Reviews & Ratings**
  - Allow students to rate and review courses
  - Display average ratings on course cards

- [ ] **Certificates**
  - Generate completion certificates
  - PDF download and verification

- [ ] **Payment Integration**
  - Stripe integration for paid courses
  - Instructor earnings dashboard

- [ ] **Video Upload**
  - Direct video upload functionality
  - Integration with cloud storage (AWS S3, Cloudinary)

- [ ] **Search & Filters**
  - Advanced search with Elasticsearch
  - More filter options (price range, rating, etc.)

- [ ] **Social Features**
  - Discussion forums per course
  - Q&A sections
  - Student-instructor messaging

- [ ] **Analytics**
  - Detailed course analytics for instructors
  - Student learning analytics
  - Platform-wide statistics

- [ ] **Notifications**
  - Email notifications
  - In-app notifications
  - Progress reminders

- [ ] **Mobile App**
  - React Native mobile application
  - Offline course access

- [ ] **Multi-language Support**
  - i18n implementation
  - Course subtitles

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 👨‍💻 Author

Built with ❤️ by SkillVerse Team

## 🙏 Acknowledgments

- shadcn/ui for the beautiful component library
- Tailwind CSS for the utility-first CSS framework
- Express.js community for excellent middleware
- React community for amazing tools and libraries

---

**Happy Learning! 🎓**
