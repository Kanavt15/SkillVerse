/**
 * Phase C5-C8 verification — reviews, discussions, follows, tags,
 * gamification and instructor stats.
 *
 * Particular attention to the things MySQL enforced for us and Mongoose does
 * not: the recursive discussion cascade, the denormalized rating aggregate, and
 * the instructor revenue figure that used to be structurally zero.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const db = require('./helpers/db');
const { sanitizeInput, securityLogger } = require('../middleware/security.middleware');
const {
    User, Course, Lesson, Enrollment, Review, DiscussionPost, DiscussionVote,
    Follow, Tag, Notification, WalletTransaction, Achievement, XpTransaction,
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
    app.use('/api/enrollments', require('../routes/enrollment.routes'));
    app.use('/api/reviews', require('../routes/review.routes'));
    app.use('/api/discussions', require('../routes/discussion.routes'));
    app.use('/api/followers', require('../routes/follower.routes'));
    app.use('/api/tags', require('../routes/tag.routes'));
    app.use('/api/gamification', require('../routes/gamification.routes'));
    app.use('/api/instructors', require('../routes/instructor.routes'));
    app.use('/api/notifications', require('../routes/notification.routes'));
    app.use((err, req, res, _next) => {
        const status = err.status || 500;
        if (status >= 500) console.error('TEST 500:', err.message);
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

let counter = 0;
const makeUser = async ({ canTeach = false } = {}) => {
    counter += 1;
    const email = `u${counter}_${Date.now()}@example.com`;
    const res = await request(app).post('/api/auth/register').send({
        email, password: 'Str0ng!Pass', full_name: `User ${counter}`,
    });
    const { id } = res.body.user;
    if (canTeach) {
        await User.updateOne({ _id: id }, { $set: { 'teaching.isEligible': true } });
    }
    return { token: res.body.accessToken, id, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
};

const makeCourse = (instructorId, over = {}) => Course.create({
    instructor: instructorId,
    title: 'Data Structures',
    description: 'Arrays and trees',
    isPublished: true,
    pointsCost: 0,
    ...over,
});

const enrol = (user, courseId) => request(app).post('/api/enrollments')
    .set(user.auth).send({ course_id: String(courseId) });

// ==================================================================
describe('reviews', () => {
    let teacher; let learner; let course;

    beforeEach(async () => {
        teacher = await makeUser({ canTeach: true });
        learner = await makeUser();
        course = await makeCourse(teacher.id);
        await enrol(learner, course._id);
    });

    const postReview = (user, rating, comment = 'Good course') => request(app)
        .post(`/api/reviews/course/${course._id}`)
        .set(user.auth).send({ rating, comment });

    it('accepts a review from an enrolled learner', async () => {
        const res = await postReview(learner, 5);
        expect(res.status).toBe(201);
        expect(res.body.review.rating).toBe(5);
        // The author is rendered inline, as the review list expects.
        expect(res.body.review.full_name).toEqual(expect.any(String));
        expect(res.body.review.user_id).toBe(learner.id);
    });

    it('updates the denormalized course rating', async () => {
        await postReview(learner, 4);
        const other = await makeUser();
        await enrol(other, course._id);
        await postReview(other, 2);

        const updated = await Course.findById(course._id);
        expect(updated.reviewCount).toBe(2);
        expect(updated.avgRating).toBe(3); // (4 + 2) / 2
    });

    it('recomputes the aggregate when a review is deleted', async () => {
        const created = await postReview(learner, 5);
        await request(app).delete(`/api/reviews/${created.body.review.id}`).set(learner.auth);

        const updated = await Course.findById(course._id);
        expect(updated.reviewCount).toBe(0);
        // COALESCE(..., 0): no reviews means zero, not null.
        expect(updated.avgRating).toBe(0);
    });

    it('refuses a review from someone not enrolled', async () => {
        const outsider = await makeUser();
        const res = await postReview(outsider, 5);
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/enrolled/i);
    });

    it('refuses to let an instructor review their own course', async () => {
        const res = await postReview(teacher, 5);
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/own course/i);
    });

    it('refuses a duplicate review', async () => {
        await postReview(learner, 5);
        const res = await postReview(learner, 1);
        expect(res.status).toBe(409);
    });

    it('refuses to let one learner edit another\'s review', async () => {
        const created = await postReview(learner, 5);
        const other = await makeUser();
        const res = await request(app).put(`/api/reviews/${created.body.review.id}`)
            .set(other.auth).send({ rating: 1, comment: 'hijacked' });
        expect(res.status).toBe(403);
    });

    it('returns a full five-bucket rating distribution', async () => {
        await postReview(learner, 5);
        const res = await request(app).get(`/api/reviews/course/${course._id}`);

        expect(res.status).toBe(200);
        expect(res.body.ratingDistribution).toEqual({ 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 });
        expect(res.body.pagination.totalReviews).toBe(1);
    });
});

// ==================================================================
describe('discussions', () => {
    let teacher; let learner; let course;

    beforeEach(async () => {
        teacher = await makeUser({ canTeach: true });
        learner = await makeUser();
        course = await makeCourse(teacher.id);
        await enrol(learner, course._id);
    });

    const post = (user, body) => request(app)
        .post(`/api/discussions/course/${course._id}`).set(user.auth).send(body);

    it('lets an enrolled learner ask a question', async () => {
        const res = await post(learner, { content: 'Why is this O(n)?' });
        expect(res.status).toBe(201);
        expect(res.body.post.parent_id).toBeNull();
        expect(res.body.post.is_instructor_reply).toBe(false);
    });

    it('flags the course instructor\'s replies', async () => {
        const q = await post(learner, { content: 'Question?' });
        const r = await post(teacher, { content: 'Answer.', parent_id: q.body.post.id });

        expect(r.status).toBe(201);
        // The instructor never enrolled, but owns the course.
        expect(r.body.post.is_instructor_reply).toBe(true);
    });

    it('refuses participation from someone not enrolled', async () => {
        const outsider = await makeUser();
        const res = await post(outsider, { content: 'Let me in' });
        expect(res.status).toBe(403);
    });

    it('refuses a reply whose parent is in another course', async () => {
        const otherCourse = await makeCourse(teacher.id, { title: 'Other' });
        const foreign = await DiscussionPost.create({
            course: otherCourse._id, author: teacher.id, content: 'elsewhere',
        });

        const res = await post(learner, { content: 'grafted', parent_id: String(foreign._id) });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/different course/i);
    });

    it('deletes the whole reply subtree with the question', async () => {
        const q = await post(learner, { content: 'Q' });
        const r1 = await post(teacher, { content: 'R1', parent_id: q.body.post.id });
        await post(learner, { content: 'R2', parent_id: r1.body.post.id });

        await request(app).delete(`/api/discussions/${q.body.post.id}`).set(learner.auth);

        // MySQL did this with a self-referencing ON DELETE CASCADE.
        expect(await DiscussionPost.countDocuments()).toBe(0);
    });

    it('toggles an upvote and keeps the count consistent', async () => {
        const q = await post(learner, { content: 'Q' });
        const voter = await makeUser();

        const up = await request(app).post(`/api/discussions/${q.body.post.id}/vote`).set(voter.auth);
        expect(up.body.voted).toBe(true);
        expect(up.body.upvote_count).toBe(1);

        const down = await request(app).post(`/api/discussions/${q.body.post.id}/vote`).set(voter.auth);
        expect(down.body.voted).toBe(false);
        expect(down.body.upvote_count).toBe(0);
        expect(await DiscussionVote.countDocuments()).toBe(0);
    });

    it('never drives the upvote count negative', async () => {
        const q = await post(learner, { content: 'Q' });
        const voter = await makeUser();

        // Unvote without ever having voted.
        await request(app).post(`/api/discussions/${q.body.post.id}/vote`).set(voter.auth);
        await request(app).post(`/api/discussions/${q.body.post.id}/vote`).set(voter.auth);
        await request(app).post(`/api/discussions/${q.body.post.id}/vote`).set(voter.auth);

        const p = await DiscussionPost.findById(q.body.post.id);
        // Replaces GREATEST(upvote_count - 1, 0).
        expect(p.upvoteCount).toBeGreaterThanOrEqual(0);
    });

    it('lists threads with reply counts and preview replies', async () => {
        const q = await post(learner, { content: 'Q' });
        await post(teacher, { content: 'R1', parent_id: q.body.post.id });
        await post(teacher, { content: 'R2', parent_id: q.body.post.id });
        await post(teacher, { content: 'R3', parent_id: q.body.post.id });

        const res = await request(app).get(`/api/discussions/course/${course._id}`).set(learner.auth);

        expect(res.body.posts).toHaveLength(1);
        expect(res.body.posts[0].reply_count).toBe(3);
        // Preview is capped at two.
        expect(res.body.posts[0].latest_replies).toHaveLength(2);
    });
});

// ==================================================================
describe('follows', () => {
    it('follows, notifies and reports status', async () => {
        const follower = await makeUser();
        const teacher = await makeUser({ canTeach: true });

        const res = await request(app).post(`/api/followers/${teacher.id}`).set(follower.auth);
        expect(res.status).toBe(201);

        const status = await request(app).get(`/api/followers/${teacher.id}/is-following`).set(follower.auth);
        expect(status.body.isFollowing).toBe(true);

        const notif = await Notification.findOne({ user: teacher.id, type: 'follower' });
        expect(notif).not.toBeNull();
    });

    it('refuses self-follow', async () => {
        const u = await makeUser();
        const res = await request(app).post(`/api/followers/${u.id}`).set(u.auth);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/yourself/i);
    });

    it('refuses a duplicate follow', async () => {
        const a = await makeUser();
        const b = await makeUser();
        await request(app).post(`/api/followers/${b.id}`).set(a.auth);
        const res = await request(app).post(`/api/followers/${b.id}`).set(a.auth);
        expect(res.status).toBe(409);
        expect(await Follow.countDocuments()).toBe(1);
    });

    it('unfollows', async () => {
        const a = await makeUser();
        const b = await makeUser();
        await request(app).post(`/api/followers/${b.id}`).set(a.auth);
        const res = await request(app).delete(`/api/followers/${b.id}`).set(a.auth);
        expect(res.status).toBe(200);
        expect(await Follow.countDocuments()).toBe(0);
    });

    it('does not leak private fields in follower lists', async () => {
        const a = await makeUser();
        const b = await makeUser();
        await request(app).post(`/api/followers/${b.id}`).set(a.auth);

        const res = await request(app).get(`/api/followers/${b.id}/followers`);
        expect(res.body.followers).toHaveLength(1);
        expect(res.body.followers[0].email).toBeUndefined();
        expect(res.body.followers[0].points).toBeUndefined();
    });
});

// ==================================================================
describe('tags', () => {
    it('creates a tag and attaches it to a course', async () => {
        const teacher = await makeUser({ canTeach: true });
        const course = await makeCourse(teacher.id);

        const created = await request(app).post('/api/tags').set(teacher.auth).send({ name: 'Graphs' });
        expect(created.status).toBe(201);
        expect(created.body.tag.slug).toBe('graphs');

        const added = await request(app).post(`/api/tags/course/${course._id}`)
            .set(teacher.auth).send({ tag_id: created.body.tag.id });
        expect(added.status).toBe(201);

        const updated = await Course.findById(course._id);
        expect(updated.tags).toHaveLength(1);
        // Denormalized counter kept in step.
        expect((await Tag.findById(created.body.tag.id)).usageCount).toBe(1);
    });

    it('is idempotent when the same tag is added twice', async () => {
        const teacher = await makeUser({ canTeach: true });
        const course = await makeCourse(teacher.id);
        const tag = await Tag.create({ name: 'arrays', slug: 'arrays' });

        await request(app).post(`/api/tags/course/${course._id}`)
            .set(teacher.auth).send({ tag_id: String(tag._id) });
        await request(app).post(`/api/tags/course/${course._id}`)
            .set(teacher.auth).send({ tag_id: String(tag._id) });

        // $addToSet replaces INSERT IGNORE against the old unique key.
        expect((await Course.findById(course._id)).tags).toHaveLength(1);
    });

    it('refuses tag edits from a non-owner', async () => {
        const teacher = await makeUser({ canTeach: true });
        const other = await makeUser({ canTeach: true });
        const course = await makeCourse(teacher.id);
        const tag = await Tag.create({ name: 'x', slug: 'x' });

        const res = await request(app).post(`/api/tags/course/${course._id}`)
            .set(other.auth).send({ tag_id: String(tag._id) });
        expect(res.status).toBe(403);
    });

    it('pulls the tag from every course when it is deleted', async () => {
        const teacher = await makeUser({ canTeach: true });
        const tag = await Tag.create({ name: 'temp', slug: 'temp' });
        const course = await makeCourse(teacher.id, { tags: [tag._id] });

        await request(app).delete(`/api/tags/${tag._id}`).set(teacher.auth);

        expect((await Course.findById(course._id)).tags).toHaveLength(0);
    });
});

// ==================================================================
describe('gamification', () => {
    it('reports stats, level and rank', async () => {
        const user = await makeUser();
        await User.updateOne({ _id: user.id }, { $set: { xp: 1000 } });

        const res = await request(app).get('/api/gamification/stats').set(user.auth);

        expect(res.status).toBe(200);
        expect(res.body.xp).toBe(1000);
        expect(res.body.xpProgress.level).toBeGreaterThan(1);
        expect(res.body.rank).toBe(1);
    });

    it('ranks the leaderboard by XP', async () => {
        const a = await makeUser();
        const b = await makeUser();
        const c = await makeUser();
        await User.updateOne({ _id: a.id }, { $set: { xp: 500 } });
        await User.updateOne({ _id: b.id }, { $set: { xp: 900 } });
        await User.updateOne({ _id: c.id }, { $set: { xp: 100 } });

        const res = await request(app).get('/api/gamification/leaderboard').set(a.auth);

        expect(res.status).toBe(200);
        expect(res.body.leaderboard[0].xp).toBe(900);
        expect(res.body.leaderboard[0].rank).toBe(1);
        expect(res.body.leaderboard[2].xp).toBe(100);
        // Replaces the COUNT(*) + 1 correlated subquery.
        expect(res.body.myRank).toBe(2);
    });

    it('does not expose emails on the leaderboard', async () => {
        const a = await makeUser();
        const res = await request(app).get('/api/gamification/leaderboard').set(a.auth);
        expect(res.body.leaderboard[0].email).toBeUndefined();
    });

    it('reports teaching progress against every requirement', async () => {
        const user = await makeUser();
        const res = await request(app).get('/api/gamification/teaching').set(user.auth);

        expect(res.status).toBe(200);
        expect(res.body.teaching.isUnlocked).toBe(false);
        expect(res.body.teaching.requirements).toHaveLength(5);
        // The UI renders "Level 7 / 10", so both numbers must be present.
        const level = res.body.teaching.requirements.find((r) => r.key === 'level');
        expect(level).toMatchObject({ current: 1, required: 10, met: false });
    });

    it('rejects an invalid timezone', async () => {
        const user = await makeUser();
        const bad = await request(app).put('/api/gamification/timezone')
            .set(user.auth).send({ timezone: 'Mars/Olympus_Mons' });
        expect(bad.status).toBe(400);

        const good = await request(app).put('/api/gamification/timezone')
            .set(user.auth).send({ timezone: 'Asia/Kolkata' });
        expect(good.status).toBe(200);
    });

    it('refuses a streak freeze the learner cannot afford', async () => {
        const user = await makeUser();
        await User.updateOne({ _id: user.id }, { $set: { 'wallet.balance': 0 } });

        const res = await request(app).post('/api/gamification/streak/freeze').set(user.auth);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not enough points/i);
    });

    it('buys a streak freeze and debits the one wallet', async () => {
        const user = await makeUser();
        const res = await request(app).post('/api/gamification/streak/freeze').set(user.auth);

        expect(res.status).toBe(200);
        expect((await User.findById(user.id)).streak.freezeCount).toBe(1);
        const ledger = await WalletTransaction.findOne({ user: user.id, source: 'streak_freeze' });
        expect(ledger.type).toBe('debit');
    });
});

// ==================================================================
describe('instructor stats', () => {
    it('reports REAL revenue from enrollment spend', async () => {
        const teacher = await makeUser({ canTeach: true });
        const course = await makeCourse(teacher.id, { pointsCost: 100 });

        const l1 = await makeUser();
        const l2 = await makeUser();
        await enrol(l1, course._id);
        await enrol(l2, course._id);

        const res = await request(app).get('/api/instructors/stats').set(teacher.auth);

        expect(res.status).toBe(200);
        expect(res.body.stats.total_courses).toBe(1);
        expect(res.body.stats.total_students).toBe(2);
        // Under MySQL this read point_transactions, which enrollment never
        // wrote to — so it was always 0 no matter how many people paid.
        expect(res.body.stats.total_revenue).toBe(200);
    });

    it('counts distinct learners, not enrollment rows', async () => {
        const teacher = await makeUser({ canTeach: true });
        const a = await makeCourse(teacher.id, { title: 'A' });
        const b = await makeCourse(teacher.id, { title: 'B' });
        const learner = await makeUser();

        await enrol(learner, a._id);
        await enrol(learner, b._id);

        const res = await request(app).get('/api/instructors/stats').set(teacher.auth);
        expect(res.body.stats.total_enrollments).toBe(2);
        expect(res.body.stats.total_students).toBe(1);
    });

    it('reports zeroes rather than dividing by zero for a new teacher', async () => {
        const teacher = await makeUser({ canTeach: true });
        const res = await request(app).get('/api/instructors/stats').set(teacher.auth);

        expect(res.status).toBe(200);
        expect(res.body.stats.completion_rate).toBe(0);
        expect(res.body.stats.avg_rating).toBe(0);
    });

    it('is refused to a learner who has not unlocked teaching', async () => {
        const learner = await makeUser();
        const res = await request(app).get('/api/instructors/stats').set(learner.auth);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('TEACHING_LOCKED');
    });
});
