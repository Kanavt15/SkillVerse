# SkillVerse Database Entity-Relationship Diagram

## Entity Relationships

```
┌─────────────┐
│   USERS     │
├─────────────┤
│ id (PK)     │
│ email       │
│ password    │
│ full_name   │
│ role        │
│ bio         │
└─────────────┘
      │
      │ 1:N (instructor)
      ▼
┌─────────────┐       ┌──────────────┐
│  COURSES    │ N:1   │ CATEGORIES   │
├─────────────┤◄──────┤──────────────┤
│ id (PK)     │       │ id (PK)      │
│ instructor_id│       │ name         │
│ category_id │       │ description  │
│ title       │       └──────────────┘
│ description │
└─────────────┘
      │
      │ 1:N
      ▼
┌─────────────┐
│  LESSONS    │
├─────────────┤
│ id (PK)     │
│ course_id   │
│ title       │
│ lesson_order│
│ video_url   │
└─────────────┘
      │
      │ 1:N
      ▼
┌──────────────────┐
│ LESSON_RESOURCES │
├──────────────────┤
│ id (PK)          │
│ lesson_id        │
│ resource_type    │
│ file_url         │
└──────────────────┘

┌─────────────┐
│   USERS     │
└─────────────┘
      │
      │ 1:N (learner)
      ▼
┌─────────────┐       ┌─────────────┐
│ ENROLLMENTS │ N:1   │  COURSES    │
├─────────────┤◄──────┤─────────────┤
│ id (PK)     │       │ id (PK)     │
│ user_id     │       └─────────────┘
│ course_id   │
│ progress_%  │
└─────────────┘
      │
      │ 1:N
      ▼
┌──────────────────┐       ┌─────────────┐
│ LESSON_PROGRESS  │ N:1   │  LESSONS    │
├──────────────────┤◄──────┤─────────────┤
│ id (PK)          │       │ id (PK)     │
│ enrollment_id    │       └─────────────┘
│ lesson_id        │
│ is_completed     │
│ time_spent       │
└──────────────────┘

┌─────────────┐
│   USERS     │
└─────────────┘
      │
      │ 1:N
      ▼
┌─────────────┐       ┌─────────────┐
│   REVIEWS   │ N:1   │  COURSES    │
├─────────────┤◄──────┤─────────────┤
│ id (PK)     │       │ id (PK)     │
│ user_id     │       └─────────────┘
│ course_id   │
│ rating      │
│ comment     │
└─────────────┘
```

## Key Relationships

1. **Users → Courses (Instructor)**
   - One instructor can create many courses
   - Type: One-to-Many

2. **Categories → Courses**
   - One category can have many courses
   - Type: One-to-Many

3. **Courses → Lessons**
   - One course contains many lessons
   - Type: One-to-Many (with ordering)

4. **Lessons → Lesson Resources**
   - One lesson can have many resources (PDFs, notes)
   - Type: One-to-Many

5. **Users → Enrollments (Learner)**
   - One user can enroll in many courses
   - Type: One-to-Many

6. **Courses → Enrollments**
   - One course can have many enrollments
   - Type: One-to-Many

7. **Enrollments → Lesson Progress**
   - One enrollment tracks progress for many lessons
   - Type: One-to-Many

8. **Lessons → Lesson Progress**
   - One lesson can have progress tracked by many enrollments
   - Type: One-to-Many

9. **Users/Courses → Reviews**
   - One user can review many courses
   - One course can have many reviews
   - Type: Many-to-Many (through reviews table)

## Indexes for Performance

- `users.email` - Fast login lookups
- `courses.instructor_id` - Instructor's course queries
- `courses.category_id` - Category filtering
- `lessons.course_id, lesson_order` - Ordered lesson retrieval
- `enrollments.user_id` - User's enrolled courses
- `lesson_progress.enrollment_id` - Progress tracking queries
