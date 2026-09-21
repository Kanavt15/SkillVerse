/**
 * Categories.
 *
 * The SQL put the `is_published` predicate in the JOIN condition rather than
 * the WHERE clause, so categories with zero published courses still appeared
 * with a count of 0. That is deliberate — the explore page lists every category
 * — and the $lookup pipeline below preserves it.
 */

const Category = require('../models/Category');
const serialize = require('../serializers');

// ------------------------------------------------------------------
// GET /api/categories
// ------------------------------------------------------------------
const getAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.aggregate([
            { $match: { isActive: true } },
            {
                $lookup: {
                    from: 'courses',
                    let: { categoryId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$category', '$$categoryId'] },
                                        { $eq: ['$isPublished', true] },
                                    ],
                                },
                            },
                        },
                        { $count: 'count' },
                    ],
                    as: 'publishedCourses',
                },
            },
            {
                $addFields: {
                    // $lookup yields [] when nothing matched, which is exactly
                    // the LEFT JOIN behavior we want: count 0, row retained.
                    courseCount: {
                        $ifNull: [{ $first: '$publishedCourses.count' }, 0],
                    },
                },
            },
            { $project: { publishedCourses: 0 } },
            { $sort: { order: 1, name: 1 } },
        ]);

        return res.json({
            success: true,
            count: categories.length,
            categories: categories.map((c) => serialize.category({ ...c, _id: c._id })),
        });
    } catch (error) {
        console.error('Get categories error:', error);
        return next(error);
    }
};

module.exports = {
    getAllCategories,
};
