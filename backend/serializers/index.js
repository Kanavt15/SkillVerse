/**
 * Legacy response serializers.
 *
 * The Mongoose models use camelCase. The shipped frontend consumes the MySQL
 * snake_case shape (`full_name`, `instructor_id`, `avg_rating`, `points`), and
 * Phase C's whole verification strategy is that the EXISTING UI keeps working
 * against MongoDB — that is what proves the port preserved behavior.
 *
 * So every controller sends responses through here. Phase D migrates the
 * frontend to camelCase and this module is deleted.
 *
 * Each serializer also emits the new camelCase fields alongside the legacy
 * ones, so frontend code can be moved over incrementally instead of in one
 * breaking commit.
 */

/** ObjectId (or anything) -> string, tolerating null. */
const id = (v) => {
    if (v == null) return null;
    if (typeof v === 'object' && v._id) return String(v._id);
    return String(v);
};

/** True when a ref was populated rather than left as a bare ObjectId. */
const isPopulated = (v) => v && typeof v === 'object' && v._id !== undefined;

/**
 * Map the new capability model back onto the role string the current UI
 * understands.
 *
 * The frontend gates the "Teach" nav on `role !== 'learner'` and derives
 * `isInstructor` from `role === 'instructor' || 'both'`. Teaching is no longer
 * a role, so it is projected: eligible users read as 'both', everyone else as
 * 'learner'. This value is DISPLAY ONLY — it is never stored, never put in a
 * JWT, and never trusted by any authorization check.
 */
const legacyRole = (user) => {
    if (!user) return 'learner';
    if (user.role === 'admin') return 'admin';
    return user.teaching?.isEligible ? 'both' : 'learner';
};

/**
 * A user as the owner sees it (own profile, login/register response).
 */
const user = (u) => {
    if (!u) return null;
    return {
        // Legacy shape
        id: id(u),
        email: u.email,
        full_name: u.fullName,
        role: legacyRole(u),
        bio: u.bio || '',
        profile_image: u.profileImage || null,
        // One unified balance replaces the old users.points / wallets.balance split.
        points: u.wallet?.balance ?? 0,
        created_at: u.createdAt,

        // New shape
        _id: id(u),
        username: u.username,
        fullName: u.fullName,
        profileImage: u.profileImage || null,
        accountRole: u.role,
        xp: u.xp ?? 0,
        level: u.level ?? 1,
        wallet: {
            balance: u.wallet?.balance ?? 0,
            totalEarned: u.wallet?.totalEarned ?? 0,
            totalSpent: u.wallet?.totalSpent ?? 0,
        },
        learningStats: u.learningStats || {},
        teaching: {
            isEligible: u.teaching?.isEligible ?? false,
            unlockedAt: u.teaching?.unlockedAt ?? null,
            coursesCreated: u.teaching?.coursesCreated ?? 0,
            coursesPublished: u.teaching?.coursesPublished ?? 0,
        },
        canTeach: u.teaching?.isEligible ?? false,
        streak: {
            current: u.streak?.current ?? 0,
            longest: u.streak?.longest ?? 0,
        },
        interests: (u.interests || []).map((i) => (isPopulated(i) ? category(i) : id(i))),
        emailVerified: u.emailVerified ?? false,
        timezone: u.timezone || 'UTC',
    };
};

/**
 * A user as OTHER people see them. Never leaks email, wallet or private stats.
 * Used for instructor bylines, leaderboards and public profiles.
 */
const publicUser = (u) => {
    if (!u) return null;
    return {
        id: id(u),
        _id: id(u),
        full_name: u.fullName,
        fullName: u.fullName,
        username: u.username,
        bio: u.bio || '',
        profile_image: u.profileImage || null,
        profileImage: u.profileImage || null,
        role: legacyRole(u),
        xp: u.xp ?? 0,
        level: u.level ?? 1,
        canTeach: u.teaching?.isEligible ?? false,
        created_at: u.createdAt,
    };
};

const category = (c) => {
    if (!c) return null;
    if (!isPopulated(c)) return { id: id(c), _id: id(c) };
    return {
        id: id(c),
        _id: id(c),
        name: c.name,
        slug: c.slug,
        description: c.description || '',
        icon: c.icon || null,
        course_count: c.courseCount ?? undefined,
        courseCount: c.courseCount ?? undefined,
    };
};

const tag = (t) => {
    if (!t) return null;
    if (!isPopulated(t)) return { id: id(t), _id: id(t) };
    return {
        id: id(t),
        _id: id(t),
        name: t.name,
        slug: t.slug,
        usage_count: t.usageCount ?? 0,
        usageCount: t.usageCount ?? 0,
    };
};

/** A lesson resource (was its own `lesson_resources` table). */
const resource = (r) => ({
    id: r._id ? String(r._id) : null,
    resource_type: r.resourceType,
    resourceType: r.resourceType,
    title: r.title,
    file_url: r.fileUrl,
    fileUrl: r.fileUrl,
    file_size: r.fileSize ?? null,
});

const lesson = (l) => {
    if (!l) return null;
    return {
        id: id(l),
        _id: id(l),
        course_id: id(l.course),
        courseId: id(l.course),
        module_id: id(l.module),
        moduleId: id(l.module),
        title: l.title,
        description: l.description || '',
        // The old column was `lesson_order`.
        lesson_order: l.order,
        order: l.order,
        video_url: l.videoUrl || null,
        videoUrl: l.videoUrl || null,
        duration_minutes: l.durationMinutes ?? 0,
        durationMinutes: l.durationMinutes ?? 0,
        content: l.content || '',
        is_free: l.isFree ?? false,
        isFree: l.isFree ?? false,
        resources: (l.resources || []).map(resource),
        created_at: l.createdAt,
        updated_at: l.updatedAt,
    };
};

const moduleDoc = (m) => {
    if (!m) return null;
    if (!isPopulated(m)) return { id: id(m), _id: id(m) };
    return {
        id: id(m),
        _id: id(m),
        course_id: id(m.course),
        title: m.title,
        description: m.description || '',
        order: m.order,
        lessons: m.lessons ? m.lessons.map(lesson) : undefined,
    };
};

/**
 * A course. `instructor` and `category` are rendered inline as the flat
 * `instructor_name` / `category_name` fields the current UI reads, and also as
 * nested objects for Phase D.
 */
const course = (c) => {
    if (!c) return null;
    if (!isPopulated(c)) return { id: id(c), _id: id(c) };

    const inst = isPopulated(c.instructor) ? c.instructor : null;
    const cat = isPopulated(c.category) ? c.category : null;

    return {
        id: id(c),
        _id: id(c),
        instructor_id: id(c.instructor),
        instructorId: id(c.instructor),
        category_id: id(c.category),
        categoryId: id(c.category),

        title: c.title,
        slug: c.slug || null,
        description: c.description || '',
        thumbnail: c.thumbnail || null,

        difficulty_level: c.difficulty,
        difficulty: c.difficulty,

        learning_objectives: c.learningObjectives || [],
        learningObjectives: c.learningObjectives || [],
        prerequisites: c.prerequisites || [],

        duration_hours: c.durationHours ?? 0,
        durationHours: c.durationHours ?? 0,

        points_cost: c.pointsCost ?? 0,
        pointsCost: c.pointsCost ?? 0,
        points_reward: c.pointsReward ?? 0,
        pointsReward: c.pointsReward ?? 0,
        // Real money, stored as integer paise.
        price: c.price ?? 0,

        is_published: c.isPublished ?? false,
        isPublished: c.isPublished ?? false,
        published_at: c.publishedAt || null,

        avg_rating: c.avgRating ?? 0,
        avgRating: c.avgRating ?? 0,
        review_count: c.reviewCount ?? 0,
        reviewCount: c.reviewCount ?? 0,

        // Denormalized on the document, so listing courses needs no joins.
        lesson_count: c.lessonCount ?? 0,
        lessonCount: c.lessonCount ?? 0,
        enrollment_count: c.enrollmentCount ?? 0,
        enrollmentCount: c.enrollmentCount ?? 0,

        instructor_name: inst ? inst.fullName : null,
        instructor_bio: inst ? inst.bio || '' : undefined,
        instructor: inst ? publicUser(inst) : id(c.instructor),

        category_name: cat ? cat.name : null,
        category: cat ? category(cat) : id(c.category),

        tags: (c.tags || []).map(tag),

        // Attached by the controller when it loads them.
        lessons: c.lessons ? c.lessons.map(lesson) : undefined,
        modules: c.modules ? c.modules.map(moduleDoc) : undefined,

        // Only present when a text search ran.
        relevance_score: c.score,

        created_at: c.createdAt,
        updated_at: c.updatedAt,
    };
};

module.exports = {
    id,
    isPopulated,
    legacyRole,
    user,
    publicUser,
    category,
    tag,
    course,
    lesson,
    module: moduleDoc,
    resource,
};
