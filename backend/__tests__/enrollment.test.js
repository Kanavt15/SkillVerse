/**
 * Phase C3 + C4 verification — unified wallet, enrollment, lesson completion.
 *
 * This is the spec's core loop: enroll -> learn -> earn XP -> level up ->
 * complete -> get a certificate -> unlock teaching. The MySQL version spread
 * that across the two point ledgers that disagreed, so the tests below pin the
 * unified behavior explicitly.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const db = require('./helpers/db');
const { sanitizeInput, securityLogger } = require('../middleware/security.middleware');
const {
    User, Course, Lesson, Enrollment, LessonProgress, WalletTransaction,
    Certificate, XpTransaction, PlatformSettings, Achievement, UserAchievement,
    DailyActivity,
} = require('../models');
const walletService = require('../services/wallet.service');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest-only';

const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(securityLogger);
    app.use(sanitizeInput);
    app.use('/api/auth', require('../routes/auth.routes'));
    app.use('/api/enrollments', require('../routes/enrollment.routes'));
    app.use('/api/wallet', require('../routes/wallet.routes'));
    app.use('/api/points', require('../routes/points.routes'));
    app.use('/api/certificates', require('../routes/certificate.routes'));
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

/**
 * Patch the settings singleton for one test.
 * getSettings() first, so the document exists for updateOne to match; the
 * cache is then dropped so the next read sees the new values.
 */
const patchSettings = async (updates) => {
    await PlatformSettings.getSettings(true);
    await PlatformSettings.updateOne({ key: 'default' }, { $set: updates });
    PlatformSettings.invalidateCache();
};

const makeUser = async (email = 'learner@example.com') => {
    const res = await request(app).post('/api/auth/register').send({
        email, password: 'Str0ng!Pass', full_name: 'A Learner',
    });
    return { token: res.body.accessToken, id: res.body.user.id, body: res.body };
};

const makeCourse = async (instructorId, over = {}) => Course.create({
    instructor: instructorId,
    title: 'Data Structures',
    description: 'Arrays and trees',
    isPublished: true,
    pointsCost: 0,
    pointsReward: 0,
    ...over,
});

const addLessons = (courseId, n) => Lesson.create(
    Array.from({ length: n }, (_, i) => ({
        course: courseId, title: `Lesson ${i + 1}`, order: i + 1,
    }))
);

describe('unified wallet', () => {
    it('credits the welcome bonus into the one balance', async () => {
        const { token } = await makeUser();
        const settings = await PlatformSettings.getSettings(true);

        const wallet = await request(app).get('/api/wallet')
            .set('Authorization', `Bearer ${token}`);
        const points = await request(app).get('/api/points')
            .set('Authorization', `Bearer ${token}`);

        expect(wallet.body.wallet.balance).toBe(settings.registrationWelcomeBonus);
        // /api/points is now an alias for the same balance. Under MySQL these
        // were two different currencies that could disagree.
        expect(points.body.points).toBe(wallet.body.wallet.balance);
    });

    it('refuses to overdraw', async () => {
        const { id } = await makeUser();
        await expect(
            walletService.debit(id, { amount: 999999, source: 'enrollment' })
        ).rejects.toThrow('Insufficient balance');

        // Nothing partial was written.
        expect(await WalletTransaction.countDocuments({ type: 'debit' })).toBe(0);
    });

    it('survives concurrent debits without going negative', async () => {
        const { id } = await makeUser();
        await User.updateOne({ _id: id }, { $set: { 'wallet.balance': 100 } });

        // Both ask for 60 of a 100 balance; exactly one may win.
        const results = await Promise.allSettled([
            walletService.debit(id, { amount: 60, source: 'enrollment' }),
            walletService.debit(id, { amount: 60, source: 'enrollment' }),
        ]);

        const ok = results.filter((r) => r.status === 'fulfilled');
        expect(ok).toHaveLength(1);

        const user = await User.findById(id);
        expect(user.wallet.balance).toBe(40);
        expect(user.wallet.balance).toBeGreaterThanOrEqual(0);
    });

    it('records balanceAfter on every ledger entry', async () => {
        const { id } = await makeUser();
        await walletService.credit(id, { amount: 50, source: 'reward' });

        const last = await WalletTransaction.findOne({ user: id }).sort({ createdAt: -1 });
        const user = await User.findById(id);
        expect(last.balanceAfter).toBe(user.wallet.balance);
    });
});

describe('POST /api/enrollments', () => {
    let learner; let instructor; let course;

    beforeEach(async () => {
        instructor = await makeUser('teacher@example.com');
        learner = await makeUser();
        course = await makeCourse(instructor.id, { pointsCost: 100 });
        await addLessons(course._id, 3);
    });

    const enroll = (token, courseId) => request(app).post('/api/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ course_id: String(courseId) });

    it('enrolls, charges the wallet and materializes lesson progress', async () => {
        const before = await walletService.getBalance(learner.id);
        const res = await enroll(learner.token, course._id);

        expect(res.status).toBe(201);
        expect(res.body.points_spent).toBe(100);
        expect(res.body.wallet_balance).toBe(before - 100);

        // One progress row per lesson, snapshotted at enrollment time.
        const enrollment = await Enrollment.findOne({ user: learner.id });
        expect(await LessonProgress.countDocuments({ enrollment: enrollment._id })).toBe(3);

        const ledger = await WalletTransaction.findOne({ user: learner.id, source: 'enrollment' });
        expect(ledger.type).toBe('debit');
        expect(ledger.amount).toBe(100);
    });

    it('increments the denormalized enrollment count', async () => {
        await enroll(learner.token, course._id);
        expect((await Course.findById(course._id)).enrollmentCount).toBe(1);
    });

    it('rejects a second enrollment', async () => {
        await enroll(learner.token, course._id);
        const res = await enroll(learner.token, course._id);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already enrolled/i);
        // And did not charge twice.
        expect(await WalletTransaction.countDocuments({ source: 'enrollment' })).toBe(1);
    });

    it('rolls back the charge when enrollment cannot complete', async () => {
        const poor = await makeUser('poor@example.com');
        await User.updateOne({ _id: poor.id }, { $set: { 'wallet.balance': 10 } });

        const res = await enroll(poor.token, course._id);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not enough points/i);
        expect(res.body.required).toBe(100);
        // All-or-nothing: no enrollment, no debit, no progress rows.
        expect(await Enrollment.countDocuments({ user: poor.id })).toBe(0);
        expect(await LessonProgress.countDocuments({ user: poor.id })).toBe(0);
        expect((await User.findById(poor.id)).wallet.balance).toBe(10);
    });

    it('refuses enrollment in an unpublished course', async () => {
        const draft = await makeCourse(instructor.id, { isPublished: false });
        const res = await enroll(learner.token, draft._id);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/unpublished/i);
    });

    it('refuses self-enrollment', async () => {
        const res = await enroll(instructor.token, course._id);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/your own course/i);
    });

    it('allows free enrollment without touching the wallet', async () => {
        const free = await makeCourse(instructor.id, { pointsCost: 0 });
        const before = await walletService.getBalance(learner.id);

        const res = await enroll(learner.token, free._id);

        expect(res.status).toBe(201);
        expect(res.body.points_spent).toBe(0);
        expect(await walletService.getBalance(learner.id)).toBe(before);
    });

    it('400s on a malformed course id', async () => {
        const res = await enroll(learner.token, 'not-an-id');
        expect(res.status).toBe(400);
    });
});

describe('lesson completion', () => {
    let learner; let instructor; let course; let lessons;

    beforeEach(async () => {
        instructor = await makeUser('teacher@example.com');
        learner = await makeUser();
        course = await makeCourse(instructor.id, { pointsCost: 0, pointsReward: 250 });
        lessons = await addLessons(course._id, 2);
        await request(app).post('/api/enrollments')
            .set('Authorization', `Bearer ${learner.token}`)
            .send({ course_id: String(course._id) });
    });

    const complete = (lessonId, minutes = 10) => request(app)
        .put(`/api/enrollments/lesson/${lessonId}/complete`)
        .set('Authorization', `Bearer ${learner.token}`)
        .send({ time_spent_minutes: minutes });

    it('awards XP and advances progress', async () => {
        const settings = await PlatformSettings.getSettings(true);
        const res = await complete(lessons[0]._id);

        expect(res.status).toBe(200);
        expect(res.body.progress_percentage).toBe(50);
        // Lesson XP plus the first-lesson-of-the-day bonus.
        expect(res.body.gamification.xp.earned).toBe(
            settings.xpRules.lessonComplete + settings.xpRules.firstLessonDaily
        );

        const user = await User.findById(learner.id);
        expect(user.learningStats.lessonsCompleted).toBe(1);
    });

    it('is idempotent — re-completing awards nothing', async () => {
        await complete(lessons[0]._id);
        const xpAfterFirst = (await User.findById(learner.id)).xp;

        const res = await complete(lessons[0]._id);

        expect(res.body.alreadyCompleted).toBe(true);
        // This is the anti-farming guard: no second award.
        expect((await User.findById(learner.id)).xp).toBe(xpAfterFirst);
    });

    it('starts and extends a streak, once per day', async () => {
        await complete(lessons[0]._id);
        let user = await User.findById(learner.id);
        expect(user.streak.current).toBe(1);

        await complete(lessons[1]._id);
        user = await User.findById(learner.id);
        // Two lessons on the same day is still a one-day streak.
        expect(user.streak.current).toBe(1);
    });

    it('records daily activity for the heatmap', async () => {
        await complete(lessons[0]._id, 15);
        const activity = await DailyActivity.findOne({ user: learner.id });

        expect(activity).not.toBeNull();
        expect(activity.lessonsCompleted).toBe(1);
        expect(activity.xpEarned).toBeGreaterThan(0);
        // Same date key as the streak service used — under MySQL these two
        // disagreed (one UTC, one user-local) and XP silently vanished.
        expect(activity.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('completes the course, pays the reward and issues a certificate', async () => {
        await complete(lessons[0]._id);
        const before = await walletService.getBalance(learner.id);

        const res = await complete(lessons[1]._id);

        expect(res.body.progress_percentage).toBe(100);
        expect(res.body.course_completed).toBe(true);
        expect(res.body.points_earned).toBe(250);
        expect(res.body.certificate_id).toBeTruthy();

        // The reward lands in the SAME wallet enrollment spends from.
        expect(await walletService.getBalance(learner.id)).toBe(before + 250);

        const reward = await WalletTransaction.findOne({ user: learner.id, source: 'reward' });
        expect(reward.type).toBe('credit');

        expect(await Certificate.countDocuments({ user: learner.id })).toBe(1);
        const user = await User.findById(learner.id);
        expect(user.learningStats.coursesCompleted).toBe(1);
        expect(user.learningStats.certificatesEarned).toBe(1);
    });

    it('does not mint a second certificate on re-completion', async () => {
        await complete(lessons[0]._id);
        await complete(lessons[1]._id);
        await complete(lessons[1]._id);

        expect(await Certificate.countDocuments({ user: learner.id })).toBe(1);
        expect(await WalletTransaction.countDocuments({ source: 'reward' })).toBe(1);
    });

    it('writes an XP ledger entry per award', async () => {
        await complete(lessons[0]._id);
        const entries = await XpTransaction.find({ user: learner.id });

        expect(entries.length).toBeGreaterThanOrEqual(2);
        expect(entries.map((e) => e.eventType)).toEqual(
            expect.arrayContaining(['lesson_complete', 'first_lesson_daily'])
        );
    });

    it('refuses a lesson the learner is not enrolled for', async () => {
        const other = await makeCourse(instructor.id, { title: 'Other' });
        const [orphan] = await addLessons(other._id, 1);

        const res = await complete(orphan._id);
        expect(res.status).toBe(404);
    });

    it('blocks completions above the hourly rate limit', async () => {
        await patchSettings({ 'antiCheat.maxLessonsPerHour': 1 });

        await complete(lessons[0]._id);
        const res = await complete(lessons[1]._id);

        expect(res.status).toBe(400);
        expect(res.body.reason).toBe('rate_limit_hourly');
    });
});

describe('teaching unlock through the learning loop', () => {
    it('unlocks once every configured requirement is met', async () => {
        const instructor = await makeUser('teacher@example.com');
        const learner = await makeUser();

        // Lower the bar to something a single course can satisfy.
        await patchSettings({
            'teachingRequirements.requiredLevel': 1,
            'teachingRequirements.requiredXP': 1,
            'teachingRequirements.requiredCoursesCompleted': 1,
            'teachingRequirements.requiredProblemsSolved': 0,
            'teachingRequirements.requiredQuizAverage': 0,
        });

        await Achievement.create({
            slug: 'knowledge-mentor',
            name: 'Knowledge Mentor',
            description: 'Demonstrated enough learning progress to begin teaching.',
            category: 'special',
            tier: 'gold',
            criteriaType: 'teaching_unlocked',
            criteriaValue: 1,
        });

        const course = await makeCourse(instructor.id, { pointsCost: 0 });
        const [lesson] = await addLessons(course._id, 1);

        await request(app).post('/api/enrollments')
            .set('Authorization', `Bearer ${learner.token}`)
            .send({ course_id: String(course._id) });

        // Before: locked.
        expect((await User.findById(learner.id)).teaching.isEligible).toBe(false);

        const res = await request(app)
            .put(`/api/enrollments/lesson/${lesson._id}/complete`)
            .set('Authorization', `Bearer ${learner.token}`)
            .send({ time_spent_minutes: 30 });

        expect(res.body.gamification.teaching.justUnlocked).toBe(true);

        const after = await User.findById(learner.id);
        expect(after.teaching.isEligible).toBe(true);
        expect(after.teaching.unlockedAt).toBeTruthy();
        // The account role never changes — teaching is a capability, not a role.
        expect(after.role).toBe('user');

        // And the Knowledge Mentor achievement was granted.
        expect(await UserAchievement.countDocuments({ user: learner.id })).toBeGreaterThan(0);

    });
});

describe('GET /api/enrollments', () => {
    it('reports per-course lesson counts and progress', async () => {
        const instructor = await makeUser('teacher@example.com');
        const learner = await makeUser();
        const course = await makeCourse(instructor.id, { pointsCost: 0 });
        const lessons = await addLessons(course._id, 4);

        await request(app).post('/api/enrollments')
            .set('Authorization', `Bearer ${learner.token}`)
            .send({ course_id: String(course._id) });
        await request(app).put(`/api/enrollments/lesson/${lessons[0]._id}/complete`)
            .set('Authorization', `Bearer ${learner.token}`)
            .send({ time_spent_minutes: 10 });

        const res = await request(app).get('/api/enrollments')
            .set('Authorization', `Bearer ${learner.token}`);

        expect(res.status).toBe(200);
        const c = res.body.courses[0];
        expect(c.total_lessons).toBe(4);
        expect(c.completed_lessons).toBe(1);
        expect(c.progress_percentage).toBe(25);
        expect(c.instructor_name).toBe('A Learner');
    });
});
