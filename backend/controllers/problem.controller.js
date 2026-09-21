/**
 * Practice Arena — problems and submissions.
 *
 * This closes the product's core loop. Teaching unlock requires
 * `problemsSolved >= 50`, and until now there was no way to solve a single
 * problem, which made the whole progression unreachable.
 *
 * SECURITY: `testCases` is `select: false` on the model. Every read here picks
 * fields explicitly and hidden cases never leave the server, so the answer key
 * cannot leak through a list view, a detail view or a failure report.
 */

const mongoose = require('mongoose');

const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Tag = require('../models/Tag');

const { withTransaction } = require('../config/mongo');
const grader = require('../services/grader.service');
const execution = require('../services/execution');
const { awardProblemXP } = require('../services/xp.service');
const { updateStreakOnActivity, updateDailyXP } = require('../services/streak.service');
const { checkAndAwardBadges } = require('../services/badge.service');
const teachingService = require('../services/teaching.service');
const { emitToUser } = require('../socket');
const { createNotification } = require('./notification.controller');

/** Public problem shape. Never includes test cases. */
const toLegacy = (p, extra = {}) => ({
    id: String(p._id),
    _id: String(p._id),
    title: p.title,
    slug: p.slug,
    difficulty: p.difficulty,
    description: p.description,
    constraints: p.constraints || '',
    input_format: p.inputFormat || '',
    output_format: p.outputFormat || '',
    examples: p.examples || [],
    tags: (p.tags || []).map((t) => (t && t.name
        ? { id: String(t._id), name: t.name, slug: t.slug }
        : { id: String(t) })),
    category: p.category && p.category.name
        ? { id: String(p.category._id), name: p.category.name }
        : null,
    supported_languages: p.supportedLanguages || [],
    starter_code: p.starterCode instanceof Map
        ? Object.fromEntries(p.starterCode)
        : (p.starterCode || {}),
    time_limit_seconds: p.timeLimitSeconds,
    memory_limit_kb: p.memoryLimitKB,
    solved_count: p.solvedCount || 0,
    attempt_count: p.attemptCount || 0,
    acceptance_rate: p.attemptCount > 0
        ? Math.round((p.solvedCount / p.attemptCount) * 100)
        : null,
    created_at: p.createdAt,
    ...extra,
});

const submissionToLegacy = (s) => ({
    id: String(s._id),
    _id: String(s._id),
    problem_id: String(s.problem?._id || s.problem),
    problem_title: s.problem?.title || undefined,
    language: s.language,
    code: s.code,
    verdict: s.verdict,
    passed_count: s.passedCount,
    total_count: s.totalCount,
    runtime_ms: s.runtimeMs,
    memory_kb: s.memoryKB,
    stderr: s.stderr,
    compile_output: s.compileOutput,
    is_first_accept: s.isFirstAccept,
    xp_awarded: s.xpAwarded,
    test_results: s.testResults,
    created_at: s.createdAt,
});

// ------------------------------------------------------------------
// GET /api/problems
// ------------------------------------------------------------------
const listProblems = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const filter = { isPublished: true };
        if (req.query.difficulty) filter.difficulty = req.query.difficulty;
        if (req.query.category && mongoose.isValidObjectId(req.query.category)) {
            filter.category = req.query.category;
        }
        if (req.query.tags) {
            const ids = String(req.query.tags).split(',')
                .filter((t) => mongoose.isValidObjectId(t));
            if (ids.length) filter.tags = { $in: ids };
        }
        if (req.query.search) {
            filter.$text = { $search: req.query.search };
        }

        const sort = req.query.sort === 'acceptance'
            ? { solvedCount: -1 }
            : { createdAt: -1 };

        const [problems, total] = await Promise.all([
            Problem.find(filter)
                .select('-testCases')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('tags', 'name slug')
                .populate('category', 'name slug')
                .lean(),
            Problem.countDocuments(filter),
        ]);

        // Mark which of these the signed-in learner has already solved, in one
        // query rather than one per row.
        let solvedIds = new Set();
        if (req.user?.id) {
            const solved = await Submission.find({
                user: req.user.id,
                problem: { $in: problems.map((p) => p._id) },
                isFirstAccept: true,
            }).select('problem').lean();
            solvedIds = new Set(solved.map((s) => String(s.problem)));
        }

        return res.json({
            success: true,
            count: problems.length,
            problems: problems.map((p) => toLegacy(p, { solved: solvedIds.has(String(p._id)) })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalProblems: total,
                limit,
            },
        });
    } catch (error) {
        console.error('List problems error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/problems/:slug
// ------------------------------------------------------------------
const getProblem = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const query = mongoose.isValidObjectId(slug) ? { _id: slug } : { slug };

        // `+testCases` is needed only to expose the VISIBLE ones as samples.
        const problem = await Problem.findOne(query)
            .select('+testCases')
            .populate('tags', 'name slug')
            .populate('category', 'name slug');

        if (!problem || !problem.isPublished) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        let solved = false;
        let attempts = 0;
        if (req.user?.id) {
            [solved, attempts] = await Promise.all([
                Submission.exists({ user: req.user.id, problem: problem._id, isFirstAccept: true })
                    .then(Boolean),
                Submission.countDocuments({ user: req.user.id, problem: problem._id }),
            ]);
        }

        return res.json({
            success: true,
            problem: toLegacy(problem, {
                // Visible cases only. Hidden ones are the grading suite.
                sample_tests: problem.visibleTestCases().map((t) => ({
                    input: t.input,
                    expected_output: t.expectedOutput,
                })),
                // The editorial is a spoiler until it has been solved.
                editorial: solved ? problem.editorial : null,
                solved,
                attempts,
            }),
            engine: execution.describe(),
        });
    } catch (error) {
        console.error('Get problem error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/problems/:slug/run   — the "Run" button, nothing persisted
// ------------------------------------------------------------------
const runCode = async (req, res, next) => {
    try {
        const { language, code, stdin } = req.body;
        if (!code || !language) {
            return res.status(400).json({ success: false, message: 'language and code are required' });
        }

        const query = mongoose.isValidObjectId(req.params.slug)
            ? { _id: req.params.slug } : { slug: req.params.slug };
        const problem = await Problem.findOne(query).select('+testCases timeLimitSeconds memoryLimitKB supportedLanguages');

        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }
        if (!problem.supportedLanguages.includes(language)) {
            return res.status(400).json({
                success: false,
                message: `This problem does not accept ${language}.`,
            });
        }

        // No custom input supplied -> use the first visible sample, which is
        // what a learner almost always wants when they hit Run.
        const sample = problem.visibleTestCases()[0];
        const input = stdin !== undefined && stdin !== null ? stdin : (sample?.input ?? '');

        const result = await grader.runOnce({ problem, language, sourceCode: code, stdin: input });

        return res.json({
            success: true,
            result: {
                status: result.status,
                stdout: result.stdout,
                stderr: result.stderr,
                compile_output: result.compileOutput,
                runtime_ms: result.runtimeMs,
                memory_kb: result.memoryKB,
                input_used: input,
                expected_output: stdin === undefined && sample ? sample.expectedOutput : undefined,
            },
        });
    } catch (error) {
        console.error('Run code error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/problems/:slug/submit
// ------------------------------------------------------------------
const submitSolution = async (req, res, next) => {
    try {
        const { language, code } = req.body;
        const userId = req.user.id;

        if (!code || !language) {
            return res.status(400).json({ success: false, message: 'language and code are required' });
        }
        if (code.length > 100_000) {
            return res.status(400).json({ success: false, message: 'Submission is too large.' });
        }

        const query = mongoose.isValidObjectId(req.params.slug)
            ? { _id: req.params.slug } : { slug: req.params.slug };
        const problem = await Problem.findOne(query).select('+testCases');

        if (!problem || !problem.isPublished) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }
        if (!problem.supportedLanguages.includes(language)) {
            return res.status(400).json({
                success: false,
                message: `This problem does not accept ${language}.`,
            });
        }

        const alreadySolved = Boolean(
            await Submission.exists({ user: userId, problem: problem._id, isFirstAccept: true })
        );

        const graded = await grader.grade({ problem, language, sourceCode: code });
        const accepted = graded.verdict === 'accepted';
        // XP only on the FIRST accept. Resubmitting a solved problem earns
        // nothing, which is what stops the XP farm.
        const isFirstAccept = accepted && !alreadySolved;

        let submission;
        let xpResult = null;
        let newBadges = [];
        let teaching = { justUnlocked: false };

        try {
            const outcome = await withTransaction(async (session) => {
                const [created] = await Submission.create([{
                    user: userId,
                    problem: problem._id,
                    language,
                    code,
                    verdict: graded.verdict,
                    testResults: graded.testResults,
                    passedCount: graded.passedCount,
                    totalCount: graded.totalCount,
                    runtimeMs: graded.runtimeMs,
                    memoryKB: graded.memoryKB,
                    stderr: graded.stderr,
                    compileOutput: graded.compileOutput,
                    isFirstAccept,
                    xpAwarded: 0,
                }], { session });

                await Problem.updateOne(
                    { _id: problem._id },
                    { $inc: { attemptCount: 1, ...(isFirstAccept ? { solvedCount: 1 } : {}) } },
                    { session }
                );

                if (!isFirstAccept) return { created, xp: null, badges: [], teach: { justUnlocked: false } };

                await User.updateOne(
                    { _id: userId },
                    { $inc: { 'learningStats.problemsSolved': 1 } },
                    { session }
                );

                const xp = await awardProblemXP(
                    userId, problem._id, problem.title, problem.difficulty, session
                );
                await Submission.updateOne(
                    { _id: created._id },
                    { $set: { xpAwarded: xp.xpAwarded } },
                    { session }
                );

                const streak = await updateStreakOnActivity(userId, session);
                await updateDailyXP(userId, xp.xpAwarded, session, { problemsSolved: 1 });

                const badges = await checkAndAwardBadges(
                    userId, { hour: new Date().getHours() }, session
                );

                // Solving a problem can be the thing that crosses the teaching
                // threshold, so eligibility is re-evaluated here too.
                const teach = await teachingService.evaluateAndUnlock(userId, session);

                return { created, xp, badges, teach, streak };
            });

            submission = outcome.created;
            xpResult = outcome.xp;
            newBadges = outcome.badges || [];
            teaching = outcome.teach || { justUnlocked: false };
        } catch (err) {
            // Lost the first-accept race against a concurrent submission.
            if (err.code === 11000) {
                submission = await Submission.create({
                    user: userId, problem: problem._id, language, code,
                    verdict: graded.verdict, testResults: graded.testResults,
                    passedCount: graded.passedCount, totalCount: graded.totalCount,
                    runtimeMs: graded.runtimeMs, memoryKB: graded.memoryKB,
                    stderr: graded.stderr, compileOutput: graded.compileOutput,
                    isFirstAccept: false, xpAwarded: 0,
                });
            } else {
                throw err;
            }
        }

        // Post-commit notifications; never allowed to fail the submission.
        try {
            if (isFirstAccept && xpResult) {
                emitToUser(userId, 'xp_earned', {
                    amount: xpResult.xpAwarded,
                    newXP: xpResult.newXP,
                    source: 'problem',
                });
                if (xpResult.leveledUp) {
                    emitToUser(userId, 'level_up', { newLevel: xpResult.newLevel });
                }
            }
            for (const badge of newBadges) {
                emitToUser(userId, 'badge_earned', badge);
                await createNotification(
                    userId, 'achievement_unlocked', 'Achievement Unlocked!',
                    `You earned "${badge.name}"`, badge._id, 'badge'
                );
            }
            if (teaching.justUnlocked) {
                await teachingService.announceUnlock(userId);
                emitToUser(userId, 'teaching_unlocked', {});
            }
        } catch (err) {
            console.error('Post-submission notification error:', err.message);
        }

        const freshUser = await User.findById(userId).select('xp level learningStats').lean();

        return res.status(201).json({
            success: true,
            submission: submissionToLegacy(submission),
            gamification: {
                xp_earned: xpResult?.xpAwarded || 0,
                total_xp: freshUser?.xp || 0,
                level: freshUser?.level || 1,
                leveled_up: Boolean(xpResult?.leveledUp),
                problems_solved: freshUser?.learningStats?.problemsSolved || 0,
                badges: newBadges.map((b) => ({
                    id: String(b._id), name: b.name, tier: b.tier, icon: b.icon,
                })),
                teaching_unlocked: teaching.justUnlocked,
            },
            // Explains a silent zero after re-solving something.
            already_solved: accepted && alreadySolved,
        });
    } catch (error) {
        console.error('Submit solution error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/problems/:slug/submissions
// ------------------------------------------------------------------
const getMySubmissions = async (req, res, next) => {
    try {
        const query = mongoose.isValidObjectId(req.params.slug)
            ? { _id: req.params.slug } : { slug: req.params.slug };
        const problem = await Problem.findOne(query).select('_id');
        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        const submissions = await Submission.find({ user: req.user.id, problem: problem._id })
            .sort({ createdAt: -1 })
            .limit(25)
            .lean();

        return res.json({
            success: true,
            submissions: submissions.map(submissionToLegacy),
        });
    } catch (error) {
        console.error('Get submissions error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/problems/me/submissions  — across all problems
// ------------------------------------------------------------------
const getAllMySubmissions = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const [submissions, total] = await Promise.all([
            Submission.find({ user: req.user.id })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('problem', 'title slug difficulty')
                .select('-code -testResults')
                .lean(),
            Submission.countDocuments({ user: req.user.id }),
        ]);

        return res.json({
            success: true,
            submissions: submissions.map(submissionToLegacy),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get all submissions error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/problems/meta/engine
// ------------------------------------------------------------------
const getEngineInfo = async (req, res) => res.json({
    success: true,
    engine: execution.describe(),
});

module.exports = {
    listProblems,
    getProblem,
    runCode,
    submitSolution,
    getMySubmissions,
    getAllMySubmissions,
    getEngineInfo,
};
