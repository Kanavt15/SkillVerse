# SkillVerse System Diagrams

## 1. User Flow Diagrams

### Registration & Authentication Flow

```
┌─────────────┐
│   Visitor   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│ Register Page   │─────►│  Submit Form │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Backend API  │
                         │ Validates    │
                         │ Hashes Pass  │
                         │ Creates User │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Returns JWT  │
                         │ Token + User │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Store in     │
                         │ LocalStorage │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Redirect to  │
                         │ Dashboard    │
                         └──────────────┘
```

### Course Discovery & Enrollment Flow

```
┌─────────────┐
│  Learner    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Browse Courses  │
│ - Search        │
│ - Filter        │
│ - Sort          │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│ Select Course   │─────►│ View Details │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Check Auth?  │
                         └──────┬───────┘
                         Yes    │    No
                    ┌───────────┴────────┐
                    ▼                    ▼
             ┌──────────────┐    ┌─────────────┐
             │ Enroll Now   │    │ Redirect to │
             │ Button       │    │ Login       │
             └──────┬───────┘    └─────────────┘
                    │
                    ▼
             ┌──────────────┐
             │ Create       │
             │ Enrollment   │
             │ Record       │
             └──────┬───────┘
                    │
                    ▼
             ┌──────────────┐
             │ Initialize   │
             │ Progress     │
             │ Tracking     │
             └──────┬───────┘
                    │
                    ▼
             ┌──────────────┐
             │ Redirect to  │
             │ My Courses   │
             └──────────────┘
```

### Course Creation Flow (Instructor)

```
┌─────────────┐
│ Instructor  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Dashboard       │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Create Course   │
│ Button          │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Course Form     │
│ - Title         │
│ - Description   │
│ - Category      │
│ - Level         │
│ - Price         │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│ Save Course     │─────►│ Create DB    │
└─────────────────┘      │ Record       │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Add Lessons  │
                         │ Page         │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ For Each     │
                         │ Lesson:      │
                         │ - Title      │
                         │ - Video URL  │
                         │ - Content    │
                         │ - Resources  │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Publish      │
                         │ Course       │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Course Live! │
                         │ Visible to   │
                         │ Learners     │
                         └──────────────┘
```

## 2. Data Flow Diagrams

### Course Progress Tracking

```
┌─────────────────────────────────────────────┐
│              Learner Actions                │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Watch    │ │ Complete │ │ Track    │
│ Lesson   │ │ Lesson   │ │ Time     │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     └────────────┼────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │  Update         │
        │  lesson_progress│
        │  Table          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Calculate      │
        │  Overall        │
        │  Progress %     │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Update         │
        │  enrollments    │
        │  Table          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Display        │
        │  Progress to    │
        │  User           │
        └─────────────────┘
```

### API Request Flow

```
┌──────────────┐
│   Client     │
│  (React)     │
└──────┬───────┘
       │ HTTP Request
       │ + JWT Token
       ▼
┌──────────────┐
│   Express    │
│   Middleware │
│   Stack      │
└──────┬───────┘
       │
       ├─► CORS Check
       ├─► Rate Limit
       ├─► Body Parse
       ├─► JWT Verify
       ├─► Role Check
       └─► Validation
       │
       ▼
┌──────────────┐
│  Controller  │
│  Function    │
└──────┬───────┘
       │
       ├─► Extract Data
       ├─► Business Logic
       └─► Database Query
       │
       ▼
┌──────────────┐
│   MySQL      │
│   Database   │
└──────┬───────┘
       │
       │ Query Result
       ▼
┌──────────────┐
│  Format      │
│  Response    │
└──────┬───────┘
       │
       │ JSON Response
       ▼
┌──────────────┐
│   Client     │
│  (React)     │
└──────────────┘
```

## 3. Component Interaction Diagram

### Frontend Component Tree

```
App.jsx
│
├── AuthProvider (Context)
│   └── Provides: user, login, logout, register
│
└── Router
    │
    ├── Navbar
    │   ├── Uses: AuthContext
    │   ├── Shows: User menu, navigation links
    │   └── Responsive: Mobile menu
    │
    └── Routes
        │
        ├── Public Routes
        │   ├── Home
        │   │   └── Hero + Features + CTA
        │   ├── Login
        │   │   └── Form + AuthContext.login()
        │   ├── Register
        │   │   └── Form + AuthContext.register()
        │   ├── Courses
        │   │   ├── Filters + Search
        │   │   └── CourseCard (map)
        │   └── CourseDetail
        │       ├── Course Info
        │       ├── Lessons List
        │       └── Enroll Button
        │
        └── Protected Routes
            │
            ├── Learner Routes
            │   ├── MyCourses
            │   │   └── EnrolledCourseCard (map)
            │   └── CoursePlayer
            │       ├── Video Player
            │       ├── Lesson Navigation
            │       └── Progress Tracking
            │
            └── Instructor Routes
                ├── InstructorDashboard
                │   ├── Stats Cards
                │   └── CourseList
                ├── CreateCourse
                │   └── Course Form
                └── EditCourse
                    ├── Course Form
                    └── Lesson Management
```

## 4. Database Transaction Flows

### Enrollment Transaction

```
BEGIN TRANSACTION;

1. Check if user already enrolled
   │
   ├─► If Yes: ROLLBACK + Error
   │
   └─► If No: Continue
       │
       ▼
2. Create enrollment record
   │
   ▼
3. Get all lessons for course
   │
   ▼
4. Create lesson_progress records
   │   (one for each lesson)
   │
   ▼
5. COMMIT TRANSACTION
   │
   ▼
6. Return success response
```

### Course Deletion Cascade

```
DELETE Course (id = X)
│
├─► CASCADE DELETE: lessons
│   │
│   └─► CASCADE DELETE: lesson_resources
│       └─► CASCADE DELETE: lesson_progress
│
├─► CASCADE DELETE: enrollments
│
└─► CASCADE DELETE: reviews
```

## 5. Security Flow

### JWT Authentication Flow

```
┌──────────────────────────────────────────┐
│            Login Request                 │
│  POST /api/auth/login                    │
│  { email, password }                     │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│         Verify Credentials               │
│  1. Find user by email                   │
│  2. Compare password hash                │
└────────────────┬─────────────────────────┘
                 │
        Valid?   │   Invalid
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌────────┐             ┌──────────────┐
│Generate│             │Return 401    │
│JWT     │             │Unauthorized  │
│Token   │             └──────────────┘
└───┬────┘
    │
    ▼
┌────────────────────────────┐
│ Token Payload:             │
│ {                          │
│   id: user.id,             │
│   email: user.email,       │
│   role: user.role          │
│ }                          │
│ Signed with: JWT_SECRET    │
│ Expires: 7 days            │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│ Return to Client:          │
│ {                          │
│   token: "eyJhbG...",      │
│   user: { ... }            │
│ }                          │
└────────────────────────────┘
```

### Protected Route Access

```
┌──────────────────────────────┐
│  Client Request              │
│  Authorization: Bearer TOKEN │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Extract Token from Header   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Verify JWT Token            │
│  jwt.verify(token, SECRET)   │
└──────────────┬───────────────┘
               │
      Valid?   │   Invalid/Expired
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌────────┐         ┌──────────┐
│Decode  │         │Return 401│
│Payload │         │Token     │
└───┬────┘         │Invalid   │
    │              └──────────┘
    ▼
┌────────────────────────────┐
│  Check Role                │
│  if route requires role    │
└──────────────┬─────────────┘
               │
    Authorized │   Forbidden
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌────────┐         ┌──────────┐
│Proceed │         │Return 403│
│to      │         │Forbidden │
│Handler │         └──────────┘
└────────┘
```

---

These diagrams help visualize:
1. User journeys through the application
2. Data flow between components
3. Database relationships and cascades
4. Security and authentication flows
5. API request/response cycles
