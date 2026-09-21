/**
 * Phase C2 verification — courses, categories, lessons.
 *
 * The course list is the query that carried the most SQL complexity (4 joins,
 * 2 COUNT(DISTINCT), GROUP BY, HAVING, fulltext relevance, a derived-table
 * count subquery). These tests pin its observable behavior so the rewrite is
 * demonstrably equivalent rather than merely plausible.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const db = require('./helpers/db');
const { sanitizeInput, securityLogger } = require('../middleware/security.middleware');
const {
    User, Category, Course, Lesson, Tag, Enrollment, LessonProgress, Review,
} = require('../models');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest-only';

const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(securityLogger);
    app.use(sanitizeInput);
    app.use('/api/auth', require('../routes/auth.routes'));
    app.use('/api/courses', require('../routes/course.routes'));
    app.use('/api/lessons', require('../routes/lesson.routes'));
    app.use('/api/categories', require('../routes/category.routes'));
    app.use((err, req, res, _next) => {
        const status = err.status || 500;
        res.status(status).json({
            success: false,
            message: status < 500 ? err.message : 'Internal Server Error',
        });
    });
    return app;
};

let app;

beforeAll(async () => { await db.connect(); app = makeApp(); }, 120000);
afterAll(async () => { await db.disconnect(); });
afterEach(async () => { await db.clear(); });

/** Register a user and return { token, id }. Optionally unlock teaching. */
const makeAuthedUser = async ({ canTeach = false, email = 'a@example.com' } = {}) => {
    const res = await request(app).post('/api/auth/register').send({
        email, password: 'Str0ng!Pass', full_name: 'Teacher Person',
    });
    const { id } = res.body.user;
    if (canTeach) {
        await User.updateOne(
            { _id: id },
            { $set: { 'teaching.isEligible': true, 'teaching.unlockedAt': new Date() } }
        );
    }
    return { token: res.body.accessToken, id };
};

const seedCourse = async (instructorId, over = {}) => Course.create({
    instructor: instructorId,
    title: 'Data Structures',
    description: 'Arrays, linked lists and trees',
    isPublished: true,
    ...over,
});

describe('teaching gate on course creation', () => {
    it('rejects a learner who has not unlocked teaching', async () => {
        const { token } = await makeAuthedUser();

        const res = await request(app).post('/api/courses')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'My Course', description: 'Some description here' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('TEACHING_LOCKED');
        expect(res.body.message).toMatch(/continue learning/i);
        expect(await Course.countDocuments()).toBe(0);
    });

    it('allows a user who has unlocked teaching', async () => {
        const { token } = await makeAuthedUser({ canTeach: true });

        const res = await request(app).post('/api/courses')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'My Course', description: 'Some description here' });

        expect(res.status).toBe(201);
        expect(res.body.course.title).toBe('My Course');
    });

    it('is enforced server-side, not just hidden in the UI', async () => {
        // Same request the frontend would make if the button were un-hidden.
        const { token } = await makeAuthedUser();
        const res = await request(app).post('/api/courses')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Bypass Attempt', description: 'Should never persist' });

        expect(res.status).toBe(403);
    });

    it('assigns difficulty-based point defaults', async () => {
        const { token } = await makeAuthedUser({ canTeach: true });
        const res = await request(app).post('/api/courses')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Advanced Algos', description: 'Hard stuff', difficulty_level: 'advanced' });

        expect(res.body.course.points_cost).toBe(200);
        expect(res.body.course.points_reward).toBe(300);
    });
});

describe('GET /api/courses', () => {
    let instructorId;

    beforeEach(async () => {
        const u = await makeAuthedUser({ canTeach: true });
        instructorId = u.id;
    });

    it('returns only published courses', async () => {
        await seedCourse(instructorId, { title: 'Published One' });
        await seedCourse(instructorId, { title: 'Draft One', isPublished: false });

        const res = await request(app).get('/api/courses');

        expect(res.status).toBe(200);
        expect(res.body.courses).toHaveLength(1);
        expect(res.body.courses[0].title).toBe('Published One');
    });

    it('keeps the legacy snake_case response shape', async () => {
        const cat = await Category.create({ name: 'Algorithms', slug: 'algorithms' });
        await seedCourse(instructorId, { category: cat._id, difficulty: 'advanced' });

        const { courses } = (await request(app).get('/api/courses')).body;
        const c = courses[0];

        // The shipped frontend reads exactly these fields.
        expect(c).toHaveProperty('instructor_id');
        expect(c).toHaveProperty('difficulty_level', 'advanced');
        expect(c).toHaveProperty('avg_rating');
        expect(c).toHaveProperty('lesson_count');
        expect(c).toHaveProperty('enrollment_count');
        expect(c.instructor_name).toBe('Teacher Person');
        expect(c.category_name).toBe('Algorithms');
    });

    it('paginates', async () => {
        await Promise.all(
            Array.from({ length: 15 }, (_, i) => seedCourse(instructorId, { title: `Course ${i}` }))
        );

        const res = await request(app).get('/api/courses?page=2&limit=10');

        expect(res.body.courses).toHaveLength(5);
        expect(res.body.pagination).toMatchObject({
            currentPage: 2, totalPages: 2, totalCourses: 15, limit: 10,
        });
    });

    it('filters by difficulty and category', async () => {
        const cat = await Category.create({ name: 'DBMS', slug: 'dbms' });
        await seedCourse(instructorId, { title: 'Easy', difficulty: 'beginner' });
        await seedCourse(instructorId, { title: 'Hard', difficulty: 'advanced', category: cat._id });

        const byDiff = await request(app).get('/api/courses?difficulty_level=advanced');
        expect(byDiff.body.courses).toHaveLength(1);
        expect(byDiff.body.courses[0].title).toBe('Hard');

        const byCat = await request(app).get(`/api/courses?category_id=${cat._id}`);
        expect(byCat.body.courses).toHaveLength(1);
    });

    it('finds courses by full-text search', async () => {
        await seedCourse(instructorId, { title: 'Binary Trees Deep Dive', description: 'traversals' });
        await seedCourse(instructorId, { title: 'Cooking Basics', description: 'unrelated' });

        const res = await request(app).get('/api/courses?search=trees');

        expect(res.body.courses).toHaveLength(1);
        expect(res.body.courses[0].title).toBe('Binary Trees Deep Dive');
    });

    it('ranks title matches above description matches', async () => {
        await seedCourse(instructorId, { title: 'Nothing special', description: 'mentions graphs once' });
        await seedCourse(instructorId, { title: 'Graphs Masterclass', description: 'unrelated text' });

        const res = await request(app).get('/api/courses?search=graphs');

        // The text index weights title 10x description, approximating the
        // relevance ordering MySQL's MATCH...AGAINST produced.
        expect(res.body.courses[0].title).toBe('Graphs Masterclass');
    });

    it('applies tag OR logic', async () => {
        const [a, b] = await Tag.create([
            { name: 'arrays', slug: 'arrays' }, { name: 'graphs', slug: 'graphs' },
        ]);
        await seedCourse(instructorId, { title: 'Has A', tags: [a._id] });
        await seedCourse(instructorId, { title: 'Has B', tags: [b._id] });
        await seedCourse(instructorId, { title: 'Has neither' });

        const res = await request(app).get(`/api/courses?tags=${a._id},${b._id}&tag_logic=or`);
        expect(res.body.courses).toHaveLength(2);
    });

    it('applies tag AND logic', async () => {
        const [a, b] = await Tag.create([
            { name: 'arrays', slug: 'arrays' }, { name: 'graphs', slug: 'graphs' },
        ]);
        await seedCourse(instructorId, { title: 'Has both', tags: [a._id, b._id] });
        await seedCourse(instructorId, { title: 'Has one', tags: [a._id] });

        // Replaces HAVING COUNT(DISTINCT tag_id) >= n and the derived-table
        // subquery the count query needed alongside it.
        const res = await request(app).get(`/api/courses?tags=${a._id},${b._id}&tag_logic=and`);

        expect(res.body.courses).toHaveLength(1);
        expect(res.body.courses[0].title).toBe('Has both');
        expect(res.body.pagination.totalCourses).toBe(1);
    });

    it('sorts by rating and by popularity', async () => {
        await seedCourse(instructorId, { title: 'Low', avgRating: 2, enrollmentCount: 100 });
        await seedCourse(instructorId, { title: 'High', avgRating: 5, enrollmentCount: 1 });

        const byRating = await request(app).get('/api/courses?sort_by=rating');
        expect(byRating.body.courses[0].title).toBe('High');

        const byPopular = await request(app).get('/api/courses?sort_by=popular');
        expect(byPopular.body.courses[0].title).toBe('Low');
    });

    it('returns an empty page rather than erroring on a malformed filter id', async () => {
        const res = await request(app).get('/api/courses?category_id=not-an-id');
        expect(res.status).toBe(200);
        expect(res.body.courses).toHaveLength(0);
    });

    it('sets the cache header', async () => {
        const plain = await request(app).get('/api/courses');
        expect(plain.headers['x-cache']).toBeDefined();

        const filtered = await request(app).get('/api/courses?search=x');
        expect(filtered.headers['x-cache']).toBe('BYPASS');
    });
});

describe('GET /api/courses/:id', () => {
    it('includes ordered lessons', async () => {
        const { id } = await makeAuthedUser({ canTeach: true });
        const course = await seedCourse(id);
        await Lesson.create([
            { course: course._id, title: 'Second', order: 2 },
            { course: course._id, title: 'First', order: 1 },
        ]);

        const res = await request(app).get(`/api/courses/${course._id}`);

        expect(res.status).toBe(200);
        expect(res.body.course.lessons.map((l) => l.title)).toEqual(['First', 'Second']);
        // Legacy field name for the ordering column.
        expect(res.body.course.lessons[0].lesson_order).toBe(1);
    });

    it('400s on a malformed id', async () => {
        const res = await request(app).get('/api/courses/nonsense');
        expect(res.status).toBe(400);
    });

    it('404s on an unknown id', async () => {
        const res = await request(app).get('/api/courses/507f1f77bcf86cd799439011');
        expect(res.status).toBe(404);
    });
});

describe('course ownership', () => {
    it('refuses to let one teacher edit another teacher\'s course', async () => {
        const owner = await makeAuthedUser({ canTeach: true, email: 'owner@example.com' });
        const other = await makeAuthedUser({ canTeach: true, email: 'other@example.com' });
        const course = await seedCourse(owner.id);

        const res = await request(app).put(`/api/courses/${course._id}`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ title: 'Hijacked' });

        expect(res.status).toBe(403);
        expect((await Course.findById(course._id)).title).toBe('Data Structures');
    });

    it('refuses deletion by a non-owner', async () => {
        const owner = await makeAuthedUser({ canTeach: true, email: 'owner@example.com' });
        const other = await makeAuthedUser({ canTeach: true, email: 'other@example.com' });
        const course = await seedCourse(owner.id);

        const res = await request(app).delete(`/api/courses/${course._id}`)
            .set('Authorization', `Bearer ${other.token}`);

        expect(res.status).toBe(403);
        expect(await Course.countDocuments()).toBe(1);
    });
});

describe('DELETE /api/courses/:id cascade', () => {
    it('removes lessons, enrollments, progress and reviews', async () => {
        const owner = await makeAuthedUser({ canTeach: true, email: 'owner@example.com' });
        const learner = await makeAuthedUser({ email: 'learner@example.com' });
        const course = await seedCourse(owner.id);

        const lesson = await Lesson.create({ course: course._id, title: 'L', order: 1 });
        const enrollment = await Enrollment.create({ user: learner.id, course: course._id });
        await LessonProgress.create({
            enrollment: enrollment._id, lesson: lesson._id, user: learner.id,
        });
        await Review.create({ user: learner.id, course: course._id, rating: 5 });

        const res = await request(app).delete(`/api/courses/${course._id}`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect(res.status).toBe(200);
        // MySQL did all of this through ON DELETE CASCADE.
        expect(await Lesson.countDocuments()).toBe(0);
        expect(await Enrollment.countDocuments()).toBe(0);
        expect(await LessonProgress.countDocuments()).toBe(0);
        expect(await Review.countDocuments()).toBe(0);
    });
});

describe('lessons', () => {
    let owner; let course;

    beforeEach(async () => {
        owner = await makeAuthedUser({ canTeach: true });
        course = await seedCourse(owner.id);
    });

    it('creates a lesson and increments the course lesson count', async () => {
        const res = await request(app).post(`/api/courses/${course._id}/lessons`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ title: 'Intro to Arrays', lesson_order: 1, duration_minutes: 12 });

        expect(res.status).toBe(201);
        expect(res.body.lesson.lesson_order).toBe(1);

        // Denormalized counter replaces the COUNT(DISTINCT l.id) join.
        expect((await Course.findById(course._id)).lessonCount).toBe(1);
    });

    it('decrements the count on delete', async () => {
        const created = await request(app).post(`/api/courses/${course._id}/lessons`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ title: 'Temp', lesson_order: 1 });

        await request(app).delete(`/api/lessons/${created.body.lesson.id}`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect((await Course.findById(course._id)).lessonCount).toBe(0);
    });

    it('refuses lesson creation by a non-owner', async () => {
        const other = await makeAuthedUser({ canTeach: true, email: 'other@example.com' });

        const res = await request(app).post(`/api/courses/${course._id}/lessons`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ title: 'Injected', lesson_order: 1 });

        expect(res.status).toBe(403);
        expect(await Lesson.countDocuments()).toBe(0);
    });

    it('exposes embedded resources with a count', async () => {
        await Lesson.create({
            course: course._id, title: 'With resources', order: 1,
            resources: [{ resourceType: 'pdf', title: 'Slides', fileUrl: '/x.pdf' }],
        });

        const res = await request(app).get(`/api/lessons/course/${course._id}`);

        expect(res.body.lessons[0].resource_count).toBe(1);
        expect(res.body.lessons[0].resources[0].file_url).toBe('/x.pdf');
    });
});

describe('GET /api/categories', () => {
    it('counts only published courses but keeps empty categories', async () => {
        const { id } = await makeAuthedUser({ canTeach: true });
        const cat = await Category.create({ name: 'DBMS', slug: 'dbms' });
        await Category.create({ name: 'Empty', slug: 'empty' });

        await seedCourse(id, { category: cat._id, isPublished: true });
        await seedCourse(id, { category: cat._id, isPublished: false });

        const res = await request(app).get('/api/categories');
        const byName = Object.fromEntries(res.body.categories.map((c) => [c.name, c.course_count]));

        expect(byName.DBMS).toBe(1);
        // The SQL put is_published in the JOIN, not the WHERE, so categories
        // with nothing published still appear. Preserved.
        expect(byName.Empty).toBe(0);
    });
});
