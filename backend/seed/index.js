/**
 * Seed script — `npm run seed`.
 *
 * Makes the platform look populated immediately after install, which is what
 * the spec asks for (§41). Replaces the raw INSERT statements that used to be
 * buried in the SQL migration files.
 *
 * Destructive: wipes the collections it owns, then rebuilds them. Pass
 * --keep-users to leave real accounts alone.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

const mongo = require('../config/mongo');
const walletService = require('../services/wallet.service');
const {
    User, Category, Tag, Course, Module, Lesson, Achievement,
    PlatformSettings, PointPackage, Problem, Quiz, Challenge, LearningPath,
    Enrollment, LessonProgress, WalletTransaction, Review,
} = require('../models');

const keepUsers = process.argv.includes('--keep-users');

// ------------------------------------------------------------------
// Categories — the 17 CSE domains from the spec (§9).
// The MySQL seed shipped Design / Photography / Music / Cooking, which belong
// to a generic skill-sharing app rather than a CSE learning platform.
// ------------------------------------------------------------------
const CATEGORIES = [
    ['Programming', 'code', 'Core programming languages and foundations'],
    ['Data Structures', 'binary', 'Arrays, lists, trees, graphs and heaps'],
    ['Algorithms', 'git-branch', 'Sorting, searching, greedy, divide and conquer'],
    ['Object-Oriented Programming', 'boxes', 'Classes, inheritance, polymorphism, design'],
    ['DBMS', 'database', 'Relational models, SQL, normalization, transactions'],
    ['Operating Systems', 'cpu', 'Processes, scheduling, memory, concurrency'],
    ['Computer Networks', 'network', 'TCP/IP, routing, protocols and sockets'],
    ['Computer Architecture', 'microchip', 'Pipelines, caches, instruction sets'],
    ['Software Engineering', 'blocks', 'Design patterns, testing, version control'],
    ['Web Development', 'globe', 'HTML, CSS, JavaScript, frameworks and APIs'],
    ['Artificial Intelligence', 'brain', 'Search, knowledge representation, agents'],
    ['Machine Learning', 'chart-line', 'Regression, classification, neural networks'],
    ['Cybersecurity', 'shield', 'Cryptography, web security, threat modelling'],
    ['Cloud Computing', 'cloud', 'Virtualization, containers, distributed systems'],
    ['DevOps', 'settings', 'CI/CD, infrastructure as code, observability'],
    ['System Design', 'layout', 'Scalability, caching, load balancing, queues'],
    ['Competitive Programming', 'trophy', 'Contest techniques and problem patterns'],
];

const TAGS = [
    'arrays', 'strings', 'linked-lists', 'trees', 'graphs', 'recursion',
    'dynamic-programming', 'greedy', 'sorting', 'searching', 'hashing',
    'mathematics', 'two-pointers', 'sliding-window', 'sql', 'react', 'nodejs',
];

// ------------------------------------------------------------------
// Achievements (§23)
// ------------------------------------------------------------------
const ACHIEVEMENTS = [
    ['first-step', 'First Step', 'Complete your first lesson.', '🌱', 'completion', 'bronze', 25, 'lessons_completed', 1],
    ['lessons-10', 'Getting Going', 'Complete 10 lessons.', '📘', 'completion', 'bronze', 50, 'lessons_completed', 10],
    ['lessons-50', 'Dedicated Learner', 'Complete 50 lessons.', '📚', 'completion', 'silver', 150, 'lessons_completed', 50],
    ['lessons-100', 'Century', 'Complete 100 lessons.', '🎯', 'completion', 'gold', 300, 'lessons_completed', 100],
    ['first-course', 'Course Master', 'Complete your first course.', '🏆', 'completion', 'bronze', 100, 'courses_completed', 1],
    ['courses-5', 'Scholar', 'Complete 5 courses.', '🎓', 'completion', 'silver', 250, 'courses_completed', 5],
    ['courses-10', 'Polymath', 'Complete 10 courses.', '👑', 'completion', 'gold', 500, 'courses_completed', 10],
    ['first-code', 'First Code', 'Successfully solve your first coding problem.', '💻', 'mastery', 'bronze', 50, 'problems_solved', 1],
    ['problem-solver', 'Problem Solver', 'Solve 50 coding problems.', '🧠', 'mastery', 'gold', 400, 'problems_solved', 50],
    ['problems-10', 'Code Apprentice', 'Solve 10 coding problems.', '⌨️', 'mastery', 'bronze', 100, 'problems_solved', 10],
    ['quiz-10', 'Quiz Whiz', 'Complete 10 quizzes.', '❓', 'mastery', 'silver', 150, 'quizzes_completed', 10],
    ['streak-3', 'Getting Warm', 'Learn for three consecutive days.', '🔥', 'streak', 'bronze', 25, 'streak_days', 3],
    ['streak-7', '7-Day Streak', 'Learn for seven consecutive days.', '🔥', 'streak', 'bronze', 50, 'streak_days', 7],
    ['streak-30', 'Unstoppable', 'Learn for thirty consecutive days.', '⚡', 'streak', 'gold', 300, 'streak_days', 30],
    ['streak-100', 'Centurion', 'Learn for one hundred consecutive days.', '💎', 'streak', 'diamond', 1000, 'streak_days', 100],
    ['level-5', 'Rising Star', 'Reach level 5.', '⭐', 'mastery', 'bronze', 50, 'level_reached', 5],
    ['level-10', 'Expert', 'Reach level 10.', '🌟', 'mastery', 'gold', 200, 'level_reached', 10],
    ['xp-1000', 'Grinder', 'Earn 1,000 XP.', '💪', 'mastery', 'bronze', 50, 'total_xp', 1000],
    ['xp-10000', 'Veteran', 'Earn 10,000 XP.', '🔱', 'mastery', 'platinum', 500, 'total_xp', 10000],
    ['knowledge-seeker', 'Knowledge Seeker', 'Complete courses from five categories.', '📚', 'engagement', 'gold', 300, 'categories_explored', 5],
    ['first-review', 'Critic', 'Post your first course review.', '✍️', 'social', 'bronze', 25, 'reviews_posted', 1],
    ['first-discussion', 'Conversationalist', 'Post your first discussion.', '💬', 'social', 'bronze', 25, 'discussions_posted', 1],
    ['helpful-5', 'Helpful', 'Receive 5 upvotes on your answers.', '🤝', 'social', 'silver', 100, 'helpful_answers', 5],
    ['early-bird', 'Early Bird', 'Complete a lesson before 8am.', '🌅', 'special', 'silver', 75, 'early_bird', 1],
    ['night-owl', 'Night Owl', 'Complete a lesson after 10pm.', '🦉', 'special', 'silver', 75, 'night_owl', 1],
    // The teaching milestone.
    ['knowledge-mentor', 'Knowledge Mentor', 'Demonstrated sufficient learning progress to begin teaching on SkillVerse.', '🎓', 'special', 'platinum', 500, 'teaching_unlocked', 1],
];

const log = (msg) => console.log(`  ${msg}`);

async function seed() {
    console.log('\n🌱 Seeding SkillVerse\n');

    const connected = await mongo.connect();
    if (!connected) {
        console.error('Could not connect to MongoDB. Is it running?');
        process.exit(1);
    }

    // ---- Reset ----
    console.log('Clearing existing content...');
    await Promise.all([
        Category.deleteMany({}), Tag.deleteMany({}), Course.deleteMany({}),
        Module.deleteMany({}), Lesson.deleteMany({}), Achievement.deleteMany({}),
        PointPackage.deleteMany({}), Problem.deleteMany({}), Quiz.deleteMany({}),
        Challenge.deleteMany({}), LearningPath.deleteMany({}),
        Enrollment.deleteMany({}), LessonProgress.deleteMany({}), Review.deleteMany({}),
    ]);
    if (!keepUsers) {
        await Promise.all([User.deleteMany({}), WalletTransaction.deleteMany({})]);
    }

    // ---- Settings ----
    await PlatformSettings.deleteMany({});
    PlatformSettings.invalidateCache();
    const settings = await PlatformSettings.getSettings(true);
    log(`Platform settings ready (teaching unlocks at level ${settings.teachingRequirements.requiredLevel})`);

    // ---- Categories & tags ----
    const categories = await Category.insertMany(
        CATEGORIES.map(([name, icon, description], i) => ({
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            icon,
            description,
            order: i,
        }))
    );
    const byCat = Object.fromEntries(categories.map((c) => [c.name, c._id]));
    log(`${categories.length} categories`);

    const tags = await Tag.insertMany(TAGS.map((name) => ({ name, slug: name })));
    const byTag = Object.fromEntries(tags.map((t) => [t.name, t._id]));
    log(`${tags.length} tags`);

    // ---- Achievements ----
    await Achievement.insertMany(
        ACHIEVEMENTS.map(([slug, name, description, icon, category, tier, xpReward, criteriaType, criteriaValue]) => ({
            slug, name, description, icon, category, tier, xpReward, criteriaType, criteriaValue,
        }))
    );
    log(`${ACHIEVEMENTS.length} achievements`);

    // ---- Point packages ----
    await PointPackage.insertMany([
        { name: 'Starter', description: '500 credits', points: 500, priceInPaise: 9900, order: 1 },
        { name: 'Learner', description: '1,200 credits + 100 bonus', points: 1200, bonusPoints: 100, priceInPaise: 19900, order: 2 },
        { name: 'Pro', description: '3,000 credits + 500 bonus', points: 3000, bonusPoints: 500, priceInPaise: 49900, order: 3 },
    ]);
    log('3 credit packages');

    // ---- Users ----
    const password = await bcrypt.hash('Passw0rd!', 12);
    const welcome = settings.registrationWelcomeBonus;

    const mkUser = (over) => ({
        password,
        wallet: { balance: welcome, totalEarned: welcome, totalSpent: 0 },
        emailVerified: true,
        ...over,
    });

    const users = await User.create([
        mkUser({
            fullName: 'Demo Learner',
            username: 'demo',
            email: 'demo@skillverse.dev',
            bio: 'Just getting started with CSE.',
            interests: [byCat['Programming'], byCat['Data Structures']],
        }),
        mkUser({
            fullName: 'Ada Advanced',
            username: 'ada',
            email: 'ada@skillverse.dev',
            bio: 'Halfway to unlocking teaching.',
            xp: 2850,
            level: 7,
            streak: { current: 12, longest: 21, lastActivityDate: null, freezeCount: 1 },
            learningStats: {
                coursesCompleted: 2, lessonsCompleted: 64, problemsSolved: 31,
                quizzesCompleted: 12, averageQuizScore: 78, learningMinutes: 1440,
            },
            interests: [byCat['Algorithms'], byCat['System Design']],
        }),
        mkUser({
            fullName: 'Grace Mentor',
            username: 'grace',
            email: 'grace@skillverse.dev',
            bio: 'Teaching data structures and algorithms.',
            xp: 12400,
            level: 16,
            // Teaching EARNED, not assigned at signup.
            teaching: { isEligible: true, unlockedAt: new Date(), coursesCreated: 5, coursesPublished: 5 },
            streak: { current: 34, longest: 88, lastActivityDate: null, freezeCount: 2 },
            learningStats: {
                coursesCompleted: 9, lessonsCompleted: 210, problemsSolved: 96,
                quizzesCompleted: 41, averageQuizScore: 88, learningMinutes: 9200,
            },
            interests: [byCat['Data Structures'], byCat['Algorithms'], byCat['DBMS']],
        }),
        mkUser({
            fullName: 'Platform Admin',
            username: 'admin',
            email: 'admin@skillverse.dev',
            role: 'admin',
            bio: 'Keeps the lights on.',
        }),
    ]);

    const [demo, ada, grace] = users;

    await WalletTransaction.insertMany(users.map((u) => ({
        user: u._id, type: 'credit', amount: welcome, source: 'welcome_bonus',
        balanceAfter: welcome, description: 'Welcome bonus - start your learning journey!',
    })));
    log(`${users.length} users (password for all: Passw0rd!)`);

    // ---- Courses ----
    const courseSpecs = [
        {
            title: 'Programming Fundamentals in C',
            category: 'Programming',
            difficulty: 'beginner',
            description: 'Variables, control flow, functions, pointers and memory. The foundation everything else builds on.',
            objectives: ['Write and compile C programs', 'Use pointers correctly', 'Manage memory manually'],
            tags: ['arrays', 'strings', 'recursion'],
            cost: 0,
            reward: 75,
            modules: [
                ['Getting Started', ['Hello, World', 'Variables and Types', 'Operators']],
                ['Control Flow', ['Conditionals', 'Loops', 'Functions']],
                ['Memory', ['Pointers', 'Dynamic Allocation', 'Structs']],
            ],
        },
        {
            title: 'Data Structures & Algorithms',
            category: 'Data Structures',
            difficulty: 'intermediate',
            description: 'Arrays, linked lists, stacks, queues, trees and graphs — with the algorithms that operate on them.',
            objectives: ['Pick the right structure for a problem', 'Analyse time and space complexity', 'Implement trees and graphs'],
            tags: ['arrays', 'linked-lists', 'trees', 'graphs', 'sorting'],
            cost: 100,
            reward: 150,
            modules: [
                ['Arrays', ['Introduction to Arrays', 'Array Operations', 'Two Pointers']],
                ['Linked Lists', ['Singly Linked Lists', 'Doubly Linked Lists', 'Reversal Techniques']],
                ['Trees', ['Binary Trees', 'Binary Search Trees', 'Traversals']],
                ['Graphs', ['Representations', 'BFS and DFS', 'Shortest Paths']],
            ],
        },
        {
            title: 'Algorithm Design Techniques',
            category: 'Algorithms',
            difficulty: 'advanced',
            description: 'Greedy, divide and conquer, and dynamic programming — how to recognise which applies.',
            objectives: ['Recognise DP subproblems', 'Prove greedy correctness', 'Analyse recurrences'],
            tags: ['dynamic-programming', 'greedy', 'recursion'],
            cost: 200,
            reward: 300,
            modules: [
                ['Divide & Conquer', ['Merge Sort', 'Quick Sort', 'Master Theorem']],
                ['Greedy', ['Activity Selection', 'Huffman Coding']],
                ['Dynamic Programming', ['Memoization', 'Tabulation', 'Knapsack', 'Longest Common Subsequence']],
            ],
        },
        {
            title: 'Database Management Systems',
            category: 'DBMS',
            difficulty: 'intermediate',
            description: 'Relational design, SQL, normalization, indexing and transactions.',
            objectives: ['Design normalized schemas', 'Write complex SQL', 'Reason about ACID'],
            tags: ['sql', 'hashing'],
            cost: 100,
            reward: 150,
            modules: [
                ['Relational Model', ['Tables and Keys', 'Relational Algebra']],
                ['SQL', ['SELECT and Joins', 'Aggregation', 'Subqueries']],
                ['Design', ['Normalization', 'Indexing', 'Transactions and ACID']],
            ],
        },
        {
            title: 'Modern Web Development',
            category: 'Web Development',
            difficulty: 'beginner',
            description: 'HTML, CSS, JavaScript, then React and REST APIs with Node.',
            objectives: ['Build a responsive page', 'Manage React state', 'Consume and design REST APIs'],
            tags: ['react', 'nodejs'],
            cost: 50,
            reward: 100,
            modules: [
                ['Foundations', ['HTML Structure', 'CSS Layout', 'JavaScript Basics']],
                ['React', ['Components and Props', 'State and Effects', 'Routing']],
                ['Backend', ['Node and Express', 'REST API Design', 'Connecting a Database']],
            ],
        },
    ];

    let lessonTotal = 0;
    const createdCourses = [];

    for (const spec of courseSpecs) {
        /* eslint-disable no-await-in-loop */
        const course = await Course.create({
            instructor: grace._id,
            category: byCat[spec.category],
            title: spec.title,
            slug: spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: spec.description,
            difficulty: spec.difficulty,
            learningObjectives: spec.objectives,
            prerequisites: spec.difficulty === 'beginner' ? [] : ['Basic programming knowledge'],
            pointsCost: spec.cost,
            pointsReward: spec.reward,
            isPublished: true,
            publishedAt: new Date(),
            tags: spec.tags.map((t) => byTag[t]).filter(Boolean),
            durationHours: spec.modules.reduce((n, [, ls]) => n + ls.length, 0) * 0.4,
        });

        let order = 1;
        for (const [modIndex, [modTitle, lessonTitles]] of spec.modules.entries()) {
            const mod = await Module.create({
                course: course._id,
                title: modTitle,
                order: modIndex + 1,
                description: `${modTitle} — ${lessonTitles.length} lessons`,
            });

            for (const title of lessonTitles) {
                await Lesson.create({
                    course: course._id,
                    module: mod._id,
                    title,
                    order,
                    description: `${title} in ${spec.title}.`,
                    durationMinutes: 8 + (order % 5) * 3,
                    isFree: order <= 2,
                    content: `# ${title}\n\nThis lesson covers **${title.toLowerCase()}** as part of ${modTitle}.\n\n`
                        + 'Work through the explanation, then try the practice exercise.',
                });
                order += 1;
                lessonTotal += 1;
            }
        }

        await Course.updateOne({ _id: course._id }, { $set: { lessonCount: order - 1 } });
        createdCourses.push(course);
        /* eslint-enable no-await-in-loop */
    }
    log(`${createdCourses.length} courses, ${lessonTotal} lessons`);

    // Denormalized tag usage counts, so /api/tags/popular is not empty.
    const tagCounts = await Course.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
    ]);
    await Promise.all(tagCounts.map((t) => Tag.updateOne(
        { _id: t._id }, { $set: { usageCount: t.count } }
    )));
    log(`tag usage counts updated (${tagCounts.length} tags in use)`);

    // ---- Enrol the demo users so the dashboard is not empty ----
    const dsCourse = createdCourses[1];
    const webCourse = createdCourses[4];

    for (const [user, course] of [[demo, webCourse], [ada, dsCourse]]) {
        /* eslint-disable no-await-in-loop */
        // Pay through the wallet service rather than inserting the enrollment
        // directly, so the ledger has the matching debit. Without it the
        // instructor dashboard reports zero revenue against real enrolments.
        if (course.pointsCost > 0) {
            await walletService.debit(user._id, {
                amount: course.pointsCost,
                source: 'enrollment',
                description: `Enrolled in ${course.title}`,
                course: course._id,
            });
        }
        const enrollment = await Enrollment.create({
            user: user._id, course: course._id, pointsPaid: course.pointsCost,
        });
        const lessons = await Lesson.find({ course: course._id }).select('_id').sort({ order: 1 }).lean();

        // Mark roughly the first third complete.
        const done = Math.floor(lessons.length / 3);
        await LessonProgress.insertMany(lessons.map((l, i) => ({
            enrollment: enrollment._id,
            lesson: l._id,
            user: user._id,
            isCompleted: i < done,
            completedAt: i < done ? new Date() : null,
            timeSpentMinutes: i < done ? 12 : 0,
        })));

        await Enrollment.updateOne(
            { _id: enrollment._id },
            { $set: { progressPercentage: Math.round((done / lessons.length) * 100) } }
        );
        await Course.updateOne({ _id: course._id }, { $inc: { enrollmentCount: 1 } });
        /* eslint-enable no-await-in-loop */
    }
    log('2 demo enrolments with partial progress');

    // ---- Reviews ----
    await Review.create([
        { user: demo._id, course: webCourse._id, rating: 5, comment: 'Clear explanations and good pacing.' },
        { user: ada._id, course: dsCourse._id, rating: 4, comment: 'Solid coverage of trees and graphs.' },
    ]);
    await Course.updateOne({ _id: webCourse._id }, { $set: { avgRating: 5, reviewCount: 1 } });
    await Course.updateOne({ _id: dsCourse._id }, { $set: { avgRating: 4, reviewCount: 1 } });
    log('2 reviews');

    // ---- Practice problems ----
    await Problem.create([
        {
            title: 'Two Sum',
            slug: 'two-sum',
            difficulty: 'easy',
            category: byCat['Data Structures'],
            tags: [byTag.arrays, byTag.hashing],
            description: 'Given an array of integers and a target, return the indices of the two numbers that add up to the target.',
            inputFormat: 'First line: n and target. Second line: n integers.',
            outputFormat: 'Two space-separated indices (0-based).',
            constraints: '2 <= n <= 10^4',
            examples: [{ input: '4 9\n2 7 11 15', output: '0 1', explanation: '2 + 7 = 9' }],
            testCases: [
                { input: '4 9\n2 7 11 15', expectedOutput: '0 1', isHidden: false, order: 1 },
                { input: '3 6\n3 2 4', expectedOutput: '1 2', isHidden: true, order: 2 },
            ],
            starterCode: new Map([
                ['python', '# Read input and print the two indices\n'],
                ['cpp', '#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n'],
            ]),
            author: grace._id,
            isPublished: true,
        },
        {
            title: 'Reverse a Linked List',
            slug: 'reverse-linked-list',
            difficulty: 'medium',
            category: byCat['Data Structures'],
            tags: [byTag['linked-lists']],
            description: 'Given the head of a singly linked list, reverse it and return the new head.',
            inputFormat: 'First line: n. Second line: n integers.',
            outputFormat: 'The reversed list, space separated.',
            constraints: '0 <= n <= 5000',
            examples: [{ input: '5\n1 2 3 4 5', output: '5 4 3 2 1', explanation: '' }],
            testCases: [
                { input: '5\n1 2 3 4 5', expectedOutput: '5 4 3 2 1', isHidden: false, order: 1 },
                { input: '1\n7', expectedOutput: '7', isHidden: true, order: 2 },
            ],
            author: grace._id,
            isPublished: true,
        },
        {
            title: 'Longest Common Subsequence',
            slug: 'longest-common-subsequence',
            difficulty: 'hard',
            category: byCat['Algorithms'],
            tags: [byTag['dynamic-programming'], byTag.strings],
            description: 'Given two strings, return the length of their longest common subsequence.',
            inputFormat: 'Two lines, one string each.',
            outputFormat: 'A single integer.',
            constraints: '1 <= length <= 1000',
            examples: [{ input: 'abcde\nace', output: '3', explanation: '"ace" is a subsequence of both' }],
            testCases: [
                { input: 'abcde\nace', expectedOutput: '3', isHidden: false, order: 1 },
                { input: 'abc\ndef', expectedOutput: '0', isHidden: true, order: 2 },
            ],
            author: grace._id,
            isPublished: true,
        },
    ]);
    log('3 practice problems');

    // ---- Quizzes ----
    await Quiz.create([{
        title: 'Complexity Basics',
        description: 'Check your understanding of Big-O.',
        course: dsCourse._id,
        category: byCat['Algorithms'],
        author: grace._id,
        isPublished: true,
        passingScore: 70,
        questions: [
            {
                order: 1,
                type: 'multiple_choice',
                prompt: 'What is the time complexity of binary search?',
                options: [
                    { id: 'a', text: 'O(n)' }, { id: 'b', text: 'O(log n)' },
                    { id: 'c', text: 'O(n²)' }, { id: 'd', text: 'O(1)' },
                ],
                correctAnswers: ['b'],
                explanation: 'Each comparison halves the remaining search space.',
                points: 1,
            },
            {
                order: 2,
                type: 'true_false',
                prompt: 'Accessing an array element by index is O(1).',
                options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }],
                correctAnswers: ['true'],
                explanation: 'The address is computed arithmetically from the base pointer.',
                points: 1,
            },
            {
                order: 3,
                type: 'multiple_select',
                prompt: 'Which of these sorts run in O(n log n) on average?',
                options: [
                    { id: 'a', text: 'Merge sort' }, { id: 'b', text: 'Bubble sort' },
                    { id: 'c', text: 'Quick sort' }, { id: 'd', text: 'Insertion sort' },
                ],
                correctAnswers: ['a', 'c'],
                explanation: 'Merge sort is always O(n log n); quick sort is on average.',
                points: 2,
            },
        ],
    }]);
    log('1 quiz');

    // ---- Daily challenge ----
    const today = new Date().toISOString().slice(0, 10);
    await Challenge.create({
        title: 'Solve 2 Array Problems',
        description: 'Warm up with two array problems today.',
        goalType: 'solve_problems',
        goalTarget: 2,
        tag: byTag.arrays,
        xpReward: settings.xpRules.dailyChallenge,
        date: today,
    });
    log(`1 daily challenge for ${today}`);

    // ---- Learning paths ----
    await LearningPath.create([
        {
            title: 'Data Structures Mastery',
            slug: 'data-structures-mastery',
            description: 'From arrays to graphs, with practice at every step.',
            difficulty: 'intermediate',
            category: byCat['Data Structures'],
            estimatedHours: 40,
            isPublished: true,
            author: grace._id,
            steps: [
                { order: 1, kind: 'course', course: createdCourses[0]._id },
                { order: 2, kind: 'course', course: dsCourse._id },
                { order: 3, kind: 'course', course: createdCourses[2]._id },
            ],
        },
        {
            title: 'Full-Stack Web Developer',
            slug: 'full-stack-web-developer',
            description: 'Build and ship a complete web application.',
            difficulty: 'beginner',
            category: byCat['Web Development'],
            estimatedHours: 30,
            isPublished: true,
            author: grace._id,
            steps: [
                { order: 1, kind: 'course', course: webCourse._id },
                { order: 2, kind: 'course', course: createdCourses[3]._id },
            ],
        },
    ]);
    log('2 learning paths');

    console.log('\n✅ Seed complete.\n');
    console.log('   Sign in with any of these (password: Passw0rd!):');
    console.log('     demo@skillverse.dev    — new learner, teaching locked');
    console.log('     ada@skillverse.dev     — level 7, partway to unlocking');
    console.log('     grace@skillverse.dev   — teaching unlocked, owns the courses');
    console.log('     admin@skillverse.dev   — admin\n');

    await mongo.close();
    process.exit(0);
}

seed().catch(async (err) => {
    console.error('\n❌ Seed failed:', err);
    await mongo.close().catch(() => {});
    process.exit(1);
});
