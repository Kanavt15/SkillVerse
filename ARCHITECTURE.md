# SkillVerse Architecture Overview

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              React Frontend (Port 3000)                 │  │
│  │  - React 18.2 + React Router                          │  │
│  │  - Tailwind CSS + shadcn/ui                           │  │
│  │  - Axios for API calls                                │  │
│  │  - Context API for state management                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                        SERVER LAYER                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            Express.js Backend (Port 5000)              │  │
│  │  - RESTful API                                        │  │
│  │  - JWT Authentication                                 │  │
│  │  - Input Validation                                   │  │
│  │  - Security Middleware (Helmet, CORS, Rate Limit)    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ MySQL2
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              MySQL Database (Port 3306)                │  │
│  │  - Normalized relational schema                       │  │
│  │  - Indexed for performance                            │  │
│  │  - Foreign key constraints                            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App.jsx
├── AuthProvider (Context)
├── Router
    ├── Navbar
    └── Routes
        ├── Home
        ├── Login
        ├── Register
        ├── Courses
        │   └── CourseCard (repeated)
        ├── CourseDetail
        │   └── LessonList
        ├── MyCourses
        │   └── EnrolledCourseCard (repeated)
        └── InstructorDashboard
            ├── Stats
            └── CourseList
                └── CreateCourse
```

### State Management

```
┌─────────────────────┐
│   AuthContext       │
│  - user             │
│  - isAuthenticated  │
│  - login()          │
│  - logout()         │
│  - register()       │
└─────────────────────┘
          │
          ├── Protected Routes
          ├── Navbar
          └── All Pages
```

### API Layer

```javascript
// API Client (src/lib/api.js)
axios instance
  ├── baseURL: /api
  ├── Interceptors
  │   ├── Request: Add JWT token
  │   └── Response: Handle 401 errors
  └── Used by all components
```

## Backend Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────┐
│                 Routes Layer                     │
│  - Define API endpoints                         │
│  - Apply middleware                             │
│  - Route to controllers                         │
└─────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│              Middleware Layer                    │
│  - Authentication (JWT verification)            │
│  - Authorization (Role checking)                │
│  - Validation (express-validator)               │
│  - Error handling                               │
└─────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│              Controllers Layer                   │
│  - Business logic                               │
│  - Request/Response handling                    │
│  - Database queries                             │
│  - Response formatting                          │
└─────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│               Database Layer                     │
│  - MySQL connection pool                        │
│  - Parameterized queries                        │
│  - Transaction support                          │
└─────────────────────────────────────────────────┘
```

### Request Flow

```
1. Client Request
   │
   ▼
2. Express Server
   ├── CORS Check
   ├── Rate Limiting
   └── Body Parsing
   │
   ▼
3. Route Matching
   │
   ▼
4. Middleware Chain
   ├── JWT Verification (if protected)
   ├── Role Authorization (if required)
   └── Input Validation
   │
   ▼
5. Controller
   ├── Extract request data
   ├── Execute business logic
   ├── Query database
   └── Format response
   │
   ▼
6. Response to Client
```

## Database Architecture

### Schema Design Principles

1. **Normalization**: 3NF (Third Normal Form)
2. **Relationships**: Enforced via foreign keys
3. **Indexing**: Strategic indexes on frequently queried columns
4. **Data Integrity**: Constraints and cascading deletes

### Key Tables and Relationships

```
users (1) ──────────┐
    │               │
    │ creates       │ enrolls
    │               │
    ▼               ▼
courses (N)    enrollments (N)
    │               │
    │ has           │ tracks
    │               │
    ▼               ▼
lessons (N)    lesson_progress (N)
    │               │
    │ has           │
    │               │
    ▼               │
lesson_resources    │
    (N)             │
                    │
    ┌───────────────┘
    │
    ▼
  lessons (N)
```

## Security Architecture

### Authentication Flow

```
1. User Registers/Logs In
   │
   ▼
2. Password Hashed (bcrypt)
   │
   ▼
3. JWT Token Generated
   ├── Payload: { id, email, role }
   ├── Secret: From environment
   └── Expiry: 7 days
   │
   ▼
4. Token Sent to Client
   │
   ▼
5. Client Stores Token (localStorage)
   │
   ▼
6. Token Sent in Headers
   Authorization: Bearer <token>
   │
   ▼
7. Server Verifies Token
   │
   ▼
8. Access Granted/Denied
```

### Authorization Levels

```
┌──────────────────────────────────────┐
│           Public Routes              │
│  - Browse courses                    │
│  - View course details               │
│  - Register/Login                    │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      Authenticated Routes            │
│  - View profile                      │
│  - Update profile                    │
└──────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ Learner│ │Instructor│
└────────┘ └──────────┘
    │           │
    ▼           ▼
┌────────┐ ┌──────────┐
│Enroll  │ │Create    │
│Track   │ │Update    │
│Progress│ │Delete    │
└────────┘ └──────────┘
```

## API Design Patterns

### RESTful Principles

```
Resource-Based URLs:
  /api/courses          - Collection
  /api/courses/:id      - Single resource
  /api/courses/:id/lessons - Nested resource

HTTP Methods:
  GET    - Retrieve
  POST   - Create
  PUT    - Update
  DELETE - Delete

Status Codes:
  200 - OK
  201 - Created
  400 - Bad Request
  401 - Unauthorized
  403 - Forbidden
  404 - Not Found
  500 - Server Error
```

### Response Format

```json
Success:
{
  "success": true,
  "message": "Optional message",
  "data": { ... }
}

Error:
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ] // Optional
}
```

## Scalability Considerations

### Current Architecture

1. **Connection Pooling**: MySQL2 connection pool (10 connections)
2. **Stateless Authentication**: JWT tokens (no server-side sessions)
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **Indexed Queries**: Strategic database indexing

### Future Scalability Enhancements

```
┌─────────────────────────────────────────┐
│        Load Balancer (Nginx)            │
└─────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐       ┌─────────┐
│ Server  │       │ Server  │
│ Instance│       │ Instance│
│    1    │       │    2    │
└─────────┘       └─────────┘
    │                   │
    └─────────┬─────────┘
              ▼
    ┌─────────────────┐
    │  Redis Cache    │
    │  (Sessions)     │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │  MySQL Master   │
    │  (Read/Write)   │
    └─────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐       ┌─────────┐
│  MySQL  │       │  MySQL  │
│  Slave  │       │  Slave  │
│  (Read) │       │  (Read) │
└─────────┘       └─────────┘
```

## Deployment Architecture

### Development Environment

```
localhost:3000 (Frontend) ──► localhost:5000 (Backend) ──► localhost:3306 (MySQL)
```

### Production Environment

```
┌──────────────────────────────────────────┐
│           CDN (Static Assets)            │
└──────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│     Frontend (Vercel/Netlify)            │
│     - React Production Build             │
│     - Environment Variables              │
└──────────────────────────────────────────┘
                  │
                  │ HTTPS
                  ▼
┌──────────────────────────────────────────┐
│     Backend (AWS/DigitalOcean)           │
│     - Node.js + PM2                      │
│     - Nginx Reverse Proxy                │
│     - SSL Certificate (Let's Encrypt)    │
└──────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│     Database (AWS RDS/Managed MySQL)     │
│     - Automated backups                  │
│     - Read replicas                      │
│     - Point-in-time recovery             │
└──────────────────────────────────────────┘
```

## Performance Optimization

### Frontend Optimizations

1. **Code Splitting**: Route-based lazy loading
2. **Caching**: Browser caching for static assets
3. **Minification**: Production build minification
4. **Image Optimization**: Lazy loading images
5. **Bundle Analysis**: Tree shaking unused code

### Backend Optimizations

1. **Database Indexing**: Strategic indexes on queries
2. **Query Optimization**: JOIN optimization, avoid N+1
3. **Connection Pooling**: Reuse database connections
4. **Caching Strategy**: Redis for frequently accessed data
5. **Compression**: Gzip response compression

### Database Optimizations

1. **Indexes**: On foreign keys, search columns
2. **Query Planning**: EXPLAIN to analyze queries
3. **Denormalization**: Where read performance critical
4. **Partitioning**: For large tables (future)
5. **Read Replicas**: Distribute read load (future)

## Monitoring & Logging

### Application Monitoring

```
┌─────────────────────────────────────┐
│     Application Logs                │
│  - Request/Response logs            │
│  - Error logs                       │
│  - Security events                  │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     Monitoring Service              │
│  - Response times                   │
│  - Error rates                      │
│  - Resource usage                   │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     Alert System                    │
│  - Email notifications              │
│  - Slack integration                │
└─────────────────────────────────────┘
```

## Error Handling Strategy

### Frontend Error Handling

```javascript
try {
  // API call
} catch (error) {
  // Show user-friendly message
  // Log error for debugging
  // Redirect to error page (if critical)
}
```

### Backend Error Handling

```javascript
// Global error handler middleware
app.use((err, req, res, next) => {
  // Log error
  // Determine error type
  // Return appropriate response
  // Hide sensitive info in production
});
```

## Testing Strategy

### Frontend Testing

1. **Unit Tests**: Component testing with Jest
2. **Integration Tests**: API integration tests
3. **E2E Tests**: Cypress for user flows

### Backend Testing

1. **Unit Tests**: Controller logic
2. **Integration Tests**: API endpoint testing
3. **Database Tests**: Query validation

## Backup & Recovery

### Database Backup Strategy

```
Daily Backups
  ├── Full Backup: 2 AM daily
  ├── Incremental: Every 6 hours
  └── Retention: 30 days

Recovery Process
  ├── Point-in-time recovery available
  ├── Automated backup testing weekly
  └── Disaster recovery plan documented
```

---

This architecture is designed to be:
- **Scalable**: Easily add more servers/resources
- **Secure**: Multiple layers of security
- **Maintainable**: Clean separation of concerns
- **Performant**: Optimized at every layer
- **Reliable**: Error handling and monitoring
