# SkillVerse API Documentation

Complete REST API documentation for the SkillVerse platform.

## Base URL

```
http://localhost:5000/api
```

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication Endpoints

### Register User

Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "learner"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "learner"
  }
}
```

### Login

Authenticate user and receive JWT token.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "learner",
    "bio": null,
    "profile_image": null
  }
}
```

### Get Profile

Get current user's profile.

**Endpoint:** `GET /auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "learner",
    "bio": "Software developer",
    "profile_image": null,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Profile

Update user profile information.

**Endpoint:** `PUT /auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "full_name": "John Updated",
  "bio": "Full-stack developer",
  "role": "both"
}
```

---

## Course Endpoints

### Get All Courses

Retrieve all published courses with optional filters.

**Endpoint:** `GET /courses`

**Query Parameters:**
- `search` - Search in title and description
- `category_id` - Filter by category ID
- `difficulty_level` - Filter by difficulty (beginner, intermediate, advanced)
- `instructor_id` - Filter by instructor ID

**Example:** `GET /courses?search=web&category_id=1&difficulty_level=beginner`

**Response:**
```json
{
  "success": true,
  "count": 10,
  "courses": [
    {
      "id": 1,
      "instructor_id": 2,
      "category_id": 1,
      "title": "Complete Web Development Bootcamp",
      "description": "Learn full-stack web development from scratch",
      "difficulty_level": "beginner",
      "price": 0.00,
      "is_published": true,
      "instructor_name": "Jane Smith",
      "category_name": "Programming",
      "lesson_count": 15,
      "enrollment_count": 42,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Single Course

Get detailed information about a specific course.

**Endpoint:** `GET /courses/:id`

**Response:**
```json
{
  "success": true,
  "course": {
    "id": 1,
    "title": "Complete Web Development Bootcamp",
    "description": "Learn full-stack web development",
    "instructor_id": 2,
    "instructor_name": "Jane Smith",
    "instructor_bio": "Experienced developer",
    "category_id": 1,
    "category_name": "Programming",
    "difficulty_level": "beginner",
    "price": 0.00,
    "is_published": true,
    "lesson_count": 15,
    "enrollment_count": 42,
    "average_rating": 4.5,
    "review_count": 20,
    "lessons": [
      {
        "id": 1,
        "title": "Introduction to HTML",
        "description": "Learn HTML basics",
        "lesson_order": 1,
        "duration_minutes": 30,
        "is_free": true
      }
    ]
  }
}
```

### Get Instructor's Courses

Get all courses created by the authenticated instructor.

**Endpoint:** `GET /courses/instructor`

**Headers:** `Authorization: Bearer <token>`

**Access:** Instructor only

**Response:**
```json
{
  "success": true,
  "count": 3,
  "courses": [
    {
      "id": 1,
      "title": "Complete Web Development Bootcamp",
      "category_name": "Programming",
      "lesson_count": 15,
      "enrollment_count": 42,
      "is_published": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Course

Create a new course (instructor only).

**Endpoint:** `POST /courses`

**Headers:** `Authorization: Bearer <token>`

**Access:** Instructor only

**Request Body:**
```json
{
  "title": "Complete Web Development Bootcamp",
  "description": "Learn full-stack web development from scratch",
  "category_id": 1,
  "difficulty_level": "beginner",
  "price": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Course created successfully",
  "course": {
    "id": 1,
    "instructor_id": 2,
    "category_id": 1,
    "title": "Complete Web Development Bootcamp",
    "description": "Learn full-stack web development from scratch",
    "difficulty_level": "beginner",
    "price": 0
  }
}
```

### Update Course

Update course details (owner only).

**Endpoint:** `PUT /courses/:id`

**Headers:** `Authorization: Bearer <token>`

**Access:** Course owner only

**Request Body:**
```json
{
  "title": "Updated Course Title",
  "description": "Updated description",
  "is_published": true,
  "price": 29.99
}
```

### Delete Course

Delete a course (owner only).

**Endpoint:** `DELETE /courses/:id`

**Headers:** `Authorization: Bearer <token>`

**Access:** Course owner only

**Response:**
```json
{
  "success": true,
  "message": "Course deleted successfully"
}
```

---

## Lesson Endpoints

### Get Course Lessons

Get all lessons for a specific course.

**Endpoint:** `GET /lessons/course/:courseId`

**Response:**
```json
{
  "success": true,
  "count": 10,
  "lessons": [
    {
      "id": 1,
      "course_id": 1,
      "title": "Introduction to HTML",
      "description": "Learn HTML basics",
      "lesson_order": 1,
      "video_url": "https://example.com/video.mp4",
      "duration_minutes": 30,
      "is_free": true,
      "resource_count": 2
    }
  ]
}
```

### Get Single Lesson

Get detailed information about a specific lesson.

**Endpoint:** `GET /lessons/:id`

**Response:**
```json
{
  "success": true,
  "lesson": {
    "id": 1,
    "course_id": 1,
    "title": "Introduction to HTML",
    "description": "Learn HTML basics",
    "lesson_order": 1,
    "video_url": "https://example.com/video.mp4",
    "duration_minutes": 30,
    "content": "Lesson content here",
    "is_free": true,
    "instructor_id": 2,
    "course_title": "Complete Web Development Bootcamp",
    "resources": [
      {
        "id": 1,
        "resource_type": "pdf",
        "title": "HTML Cheat Sheet",
        "file_url": "/uploads/html-cheatsheet.pdf",
        "file_size": 1024000
      }
    ]
  }
}
```

### Create Lesson

Create a new lesson (instructor only).

**Endpoint:** `POST /lessons`

**Headers:** `Authorization: Bearer <token>`

**Access:** Course owner only

**Request Body:**
```json
{
  "course_id": 1,
  "title": "Introduction to HTML",
  "description": "Learn HTML basics",
  "lesson_order": 1,
  "video_url": "https://example.com/video.mp4",
  "duration_minutes": 30,
  "content": "Detailed lesson content",
  "is_free": false
}
```

### Update Lesson

Update lesson details (owner only).

**Endpoint:** `PUT /lessons/:id`

**Headers:** `Authorization: Bearer <token>`

**Access:** Course owner only

### Delete Lesson

Delete a lesson (owner only).

**Endpoint:** `DELETE /lessons/:id`

**Headers:** `Authorization: Bearer <token>`

**Access:** Course owner only

---

## Enrollment Endpoints

### Enroll in Course

Enroll the authenticated user in a course.

**Endpoint:** `POST /enrollments`

**Headers:** `Authorization: Bearer <token>`

**Access:** Learner only

**Request Body:**
```json
{
  "course_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully enrolled in course",
  "enrollment": {
    "id": 1,
    "user_id": 1,
    "course_id": 1,
    "enrolled_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Enrolled Courses

Get all courses the user is enrolled in.

**Endpoint:** `GET /enrollments`

**Headers:** `Authorization: Bearer <token>`

**Access:** Learner only

**Response:**
```json
{
  "success": true,
  "count": 5,
  "enrollments": [
    {
      "id": 1,
      "user_id": 1,
      "course_id": 1,
      "enrolled_at": "2024-01-01T00:00:00.000Z",
      "progress_percentage": 45.5,
      "title": "Complete Web Development Bootcamp",
      "description": "Learn full-stack web development",
      "instructor_name": "Jane Smith",
      "category_name": "Programming",
      "difficulty_level": "beginner",
      "total_lessons": 15,
      "completed_lessons": 7
    }
  ]
}
```

### Get Course Progress

Get detailed progress for a specific enrolled course.

**Endpoint:** `GET /enrollments/course/:courseId`

**Headers:** `Authorization: Bearer <token>`

**Access:** Learner only (must be enrolled)

**Response:**
```json
{
  "success": true,
  "enrollment": {
    "id": 1,
    "user_id": 1,
    "course_id": 1,
    "enrolled_at": "2024-01-01T00:00:00.000Z",
    "progress_percentage": 45.5,
    "completed_at": null
  },
  "progress": [
    {
      "id": 1,
      "enrollment_id": 1,
      "lesson_id": 1,
      "is_completed": true,
      "completed_at": "2024-01-02T00:00:00.000Z",
      "time_spent_minutes": 35,
      "title": "Introduction to HTML",
      "lesson_order": 1,
      "duration_minutes": 30
    }
  ]
}
```

### Mark Lesson Complete

Mark a lesson as completed.

**Endpoint:** `PUT /enrollments/lesson/:lessonId/complete`

**Headers:** `Authorization: Bearer <token>`

**Access:** Learner only (must be enrolled)

**Request Body:**
```json
{
  "time_spent_minutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lesson marked as complete",
  "progress_percentage": 50.0
}
```

### Update Lesson Progress

Update time spent on a lesson.

**Endpoint:** `PUT /enrollments/lesson/:lessonId/progress`

**Headers:** `Authorization: Bearer <token>`

**Access:** Learner only (must be enrolled)

**Request Body:**
```json
{
  "time_spent_minutes": 15
}
```

---

## Category Endpoints

### Get All Categories

Get all course categories with course counts.

**Endpoint:** `GET /categories`

**Response:**
```json
{
  "success": true,
  "count": 8,
  "categories": [
    {
      "id": 1,
      "name": "Programming",
      "description": "Software development and coding skills",
      "icon": "code",
      "course_count": 42,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## User Endpoints

### Get User by ID

Get public profile information for a specific user.

**Endpoint:** `GET /users/:id`

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "instructor",
    "bio": "Experienced developer",
    "profile_image": null,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Validation Errors

```json
{
  "success": false,
  "errors": [
    {
      "msg": "Valid email is required",
      "param": "email",
      "location": "body"
    }
  ]
}
```

---

## Rate Limiting

- **Limit:** 100 requests per 15 minutes per IP
- **Response when exceeded:**
  ```json
  {
    "message": "Too many requests, please try again later."
  }
  ```
