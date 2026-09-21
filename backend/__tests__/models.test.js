/**
 * Phase B verification: the guarantees MySQL used to provide must still hold.
 *
 * Covers the two things most likely to cause silent data corruption after the
 * migration — cascade deletes (Mongoose has none) and the unique constraints
 * several controllers lean on for correctness — plus the level curve and
 * transaction support.
 */

const mongoose = require('mongoose');
const db = require('./helpers/db');
const {
    User, Category, Course, Module, Lesson, Enrollment, LessonProgress,
    Review, Certificate, DiscussionPost, DiscussionVote, Follow,
    Achievement, UserAchievement, Submission, Problem, WalletTransaction,
    PlatformSettings, Challenge, UserChallenge,
} = require('../models');

beforeAll(async () => { await db.connect(); }, 120000);
afterAll(async () => { await db.disconnect(); });
afterEach(async () => { await db.clear(); });

/** Minimal valid user. */
const makeUser = (over = {}) => User.create({
    fullName: 'Test Learner',
    username: `user${Math.random().toString(36).slice(2, 10)}`,
    email: `${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: 'hashed',
    ...over,
});

const makeCourse = (instructor, over = {}) => Course.create({
    instructor: instructor._id,
    title: 'Data Structures',
    description: 'Arrays, lists, trees',
    ...over,
});

describe('cascade deletes', () => {
    it('deleting a course removes its lessons, enrollments and reviews', async () => {
        const instructor = await makeUser();
        const learner = await makeUser();
        const course = await makeCourse(instructor);

        const lesson = await Lesson.create({ course: course._id, title: 'Arrays', order: 1 });
        const enrollment = await Enrollment.create({ user: learner._id, course: course._id });
        await Review.create({ user: learner._id, course: course._id, rating: 5 });
        await Certificate.create({
            user: learner._id, course: course._id,
            instructorName: 'X', courseTitle: 'Y', learnerName: 'Z',
        });

        await Course.findByIdAndDelete(course._id);

        expect(await Lesson.countDocuments({ _id: lesson._id })).toBe(0);
        expect(await Enrollment.countDocuments({ _id: enrollment._id })).toBe(0);
        expect(await Review.countDocuments({ course: course._id })).toBe(0);
        expect(await Certificate.countDocuments({ course: course._id })).toBe(0);
    });

    it('cascades through two levels: course -> enrollment -> lesson progress', async () => {
        const instructor = await makeUser();
        const learner = await makeUser();
        const course = await makeCourse(instructor);
        const lesson = await Lesson.create({ course: course._id, title: 'L', order: 1 });
        const enrollment = await Enrollment.create({ user: learner._id, course: course._id });
        await LessonProgress.create({
            enrollment: enrollment._id, lesson: lesson._id, user: learner._id,
        });

        await Course.findByIdAndDelete(course._id);

        // LessonProgress is a grandchild — reachable only if the cascade recurses.
        expect(await LessonProgress.countDocuments({})).toBe(0);
    });

    it('deleting a discussion question removes its whole reply subtree', async () => {
        const author = await makeUser();
        const course = await makeCourse(author);

        const question = await DiscussionPost.create({
            course: course._id, author: author._id, content: 'Why?',
        });
        const reply = await DiscussionPost.create({
            course: course._id, author: author._id, content: 'Because', parent: question._id,
        });
        const nested = await DiscussionPost.create({
            course: course._id, author: author._id, content: 'I see', parent: reply._id,
        });
        await DiscussionVote.create({ post: reply._id, user: author._id });

        await DiscussionPost.findByIdAndDelete(question._id);

        // Self-referential cascade must reach arbitrary depth.
        expect(await DiscussionPost.countDocuments({ _id: reply._id })).toBe(0);
        expect(await DiscussionPost.countDocuments({ _id: nested._id })).toBe(0);
        expect(await DiscussionVote.countDocuments({})).toBe(0);
    });

    it('deleting a user removes everything they own', async () => {
        const user = await makeUser();
        const other = await makeUser();
        const course = await makeCourse(other);

        await Enrollment.create({ user: user._id, course: course._id });
        await Review.create({ user: user._id, course: course._id, rating: 4 });
        await Follow.create({ follower: user._id, following: other._id });
        await WalletTransaction.create({
            user: user._id, type: 'credit', amount: 500,
            source: 'welcome_bonus', balanceAfter: 500,
        });

        await User.findByIdAndDelete(user._id);

        expect(await Enrollment.countDocuments({ user: user._id })).toBe(0);
        expect(await Review.countDocuments({ user: user._id })).toBe(0);
        expect(await Follow.countDocuments({ follower: user._id })).toBe(0);
        expect(await WalletTransaction.countDocuments({ user: user._id })).toBe(0);
    });

    it('deleting a category orphans courses rather than destroying them', async () => {
        const instructor = await makeUser();
        const category = await Category.create({ name: 'DBMS', slug: 'dbms' });
        const course = await makeCourse(instructor, { category: category._id });

        await Category.findByIdAndDelete(category._id);

        // ON DELETE SET NULL, not CASCADE — losing a category must not lose
        // every course filed under it.
        const still = await Course.findById(course._id);
        expect(still).not.toBeNull();
        expect(still.category == null).toBe(true);
    });

    it('deleting a module removes its lessons', async () => {
        const instructor = await makeUser();
        const course = await makeCourse(instructor);
        const mod = await Module.create({ course: course._id, title: 'M1', order: 1 });
        await Lesson.create({ course: course._id, module: mod._id, title: 'L', order: 1 });

        await Module.findByIdAndDelete(mod._id);
        expect(await Lesson.countDocuments({})).toBe(0);
    });
});

describe('unique constraints the controllers rely on', () => {
    it('rejects double enrollment', async () => {
        const user = await makeUser();
        const course = await makeCourse(await makeUser());
        await Enrollment.create({ user: user._id, course: course._id });
        await expect(
            Enrollment.create({ user: user._id, course: course._id })
        ).rejects.toThrow();
    });

    it('rejects a second review of the same course', async () => {
        const user = await makeUser();
        const course = await makeCourse(await makeUser());
        await Review.create({ user: user._id, course: course._id, rating: 5 });
        await expect(
            Review.create({ user: user._id, course: course._id, rating: 1 })
        ).rejects.toThrow();
    });

    it('rejects a duplicate certificate for the same course', async () => {
        const user = await makeUser();
        const course = await makeCourse(await makeUser());
        const payload = {
            user: user._id, course: course._id,
            instructorName: 'A', courseTitle: 'B', learnerName: 'C',
        };
        await Certificate.create(payload);
        await expect(Certificate.create(payload)).rejects.toThrow();
    });

    it('rejects awarding the same achievement twice', async () => {
        const user = await makeUser();
        const ach = await Achievement.create({
            slug: 'first-step', name: 'First Step', description: 'x',
            category: 'completion', criteriaType: 'lessons_completed', criteriaValue: 1,
        });
        await UserAchievement.create({ user: user._id, achievement: ach._id });
        await expect(
            UserAchievement.create({ user: user._id, achievement: ach._id })
        ).rejects.toThrow();
    });

    it('rejects a duplicate razorpay payment id (double-credit guard)', async () => {
        const user = await makeUser();
        const base = {
            user: user._id, type: 'credit', amount: 100,
            source: 'purchase', balanceAfter: 100, razorpayPaymentId: 'pay_ABC123',
        };
        await WalletTransaction.create(base);
        await expect(WalletTransaction.create(base)).rejects.toThrow();
    });

    it('allows many transactions without a payment id', async () => {
        const user = await makeUser();
        const base = {
            user: user._id, type: 'debit', amount: 10,
            source: 'enrollment', balanceAfter: 0,
        };
        await WalletTransaction.create(base);
        // Sparse index: null payment ids must not collide with each other.
        await expect(WalletTransaction.create(base)).resolves.toBeDefined();
    });

    it('rejects claiming a challenge reward twice', async () => {
        const user = await makeUser();
        const ch = await Challenge.create({
            title: 'Solve 2', goalType: 'solve_problems', goalTarget: 2, date: '2026-09-21',
        });
        await UserChallenge.create({ user: user._id, challenge: ch._id });
        await expect(
            UserChallenge.create({ user: user._id, challenge: ch._id })
        ).rejects.toThrow();
    });
});

describe('Submission first-accept guard', () => {
    const makeProblem = async (author) => Problem.create({
        title: 'Two Sum', slug: `two-sum-${Math.random().toString(36).slice(2, 8)}`,
        difficulty: 'easy', description: 'd', author: author._id,
    });

    it('allows many ordinary submissions for one problem', async () => {
        const user = await makeUser();
        const problem = await makeProblem(user);
        const base = { user: user._id, problem: problem._id, language: 'python', code: 'x' };

        await Submission.create({ ...base, verdict: 'wrong_answer' });
        await Submission.create({ ...base, verdict: 'wrong_answer' });
        expect(await Submission.countDocuments({})).toBe(2);
    });

    it('allows only ONE first-accept per user per problem', async () => {
        const user = await makeUser();
        const problem = await makeProblem(user);
        const base = {
            user: user._id, problem: problem._id, language: 'python',
            code: 'x', verdict: 'accepted', isFirstAccept: true,
        };

        await Submission.create(base);
        // This is what stops XP farming by resubmitting a solved problem.
        await expect(Submission.create(base)).rejects.toThrow();
    });
});

describe('PlatformSettings level curve', () => {
    it('creates itself on first access', async () => {
        const s = await PlatformSettings.getSettings(true);
        expect(s.teachingRequirements.requiredLevel).toBe(10);
        expect(s.xpRules.lessonComplete).toBe(20);
    });

    it('levelForXP is the exact inverse of xpForLevel', async () => {
        const s = await PlatformSettings.getSettings(true);
        // The MySQL implementation used two unrelated formulas, so this
        // round-trip did not hold and xpInCurrentLevel could go negative.
        for (let level = 1; level <= 50; level += 1) {
            const xp = s.xpForLevel(level);
            expect(s.levelForXP(xp)).toBe(level);
        }
    });

    it('never reports negative progress into a level', async () => {
        const s = await PlatformSettings.getSettings(true);
        for (let xp = 0; xp <= 60000; xp += 137) {
            const p = s.xpProgress(xp);
            expect(p.xpInCurrentLevel).toBeGreaterThanOrEqual(0);
            expect(p.progressPercentage).toBeGreaterThanOrEqual(0);
            expect(p.progressPercentage).toBeLessThanOrEqual(100);
        }
    });

    it('names level 10 Knowledge Mentor', async () => {
        const s = await PlatformSettings.getSettings(true);
        expect(s.xpProgress(s.xpForLevel(10)).title).toBe('Knowledge Mentor');
    });
});

describe('User defaults', () => {
    it('starts locked out of teaching at level 1 with no XP', async () => {
        const u = await makeUser();
        expect(u.role).toBe('user');
        expect(u.level).toBe(1);
        expect(u.xp).toBe(0);
        expect(u.teaching.isEligible).toBe(false);
        expect(u.teaching.unlockedAt).toBeNull();
        expect(u.canTeach).toBe(false);
    });

    it('has no role value that could bypass authorization', async () => {
        // 'both' used to pass every authorize() check. It must not be storable.
        await expect(makeUser({ role: 'both' })).rejects.toThrow();
        await expect(makeUser({ role: 'instructor' })).rejects.toThrow();
    });

    it('keeps secrets out of serialized output', async () => {
        const u = await makeUser();
        const json = u.toSafeJSON();
        expect(json.password).toBeUndefined();
        expect(json.passwordResetToken).toBeUndefined();
    });

    it('enforces unique email and username', async () => {
        const u = await makeUser();
        await expect(makeUser({ email: u.email })).rejects.toThrow();
        await expect(makeUser({ username: u.username })).rejects.toThrow();
    });
});

describe('transactions', () => {
    it('rolls back every write when the session aborts', async () => {
        const user = await makeUser();
        const course = await makeCourse(await makeUser());

        const session = await mongoose.startSession();
        await expect(session.withTransaction(async () => {
            await Enrollment.create([{ user: user._id, course: course._id }], { session });
            await WalletTransaction.create([{
                user: user._id, type: 'debit', amount: 50,
                source: 'enrollment', balanceAfter: 0,
            }], { session });
            throw new Error('simulated failure mid-enrollment');
        })).rejects.toThrow('simulated failure');
        await session.endSession();

        // Enrollment must be all-or-nothing: no enrollment without its ledger
        // entry, and no debit without the enrollment it paid for.
        expect(await Enrollment.countDocuments({})).toBe(0);
        expect(await WalletTransaction.countDocuments({})).toBe(0);
    });
});
