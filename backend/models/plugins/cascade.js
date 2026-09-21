/**
 * Cascade-delete support for Mongoose.
 *
 * MySQL enforced 7 parent->child chains with ON DELETE CASCADE, and three
 * controllers relied on it silently — they delete a parent and never touch the
 * children (course.controller.js:594, lesson.controller.js:294,
 * discussion.controller.js:321). Mongoose has no equivalent, so without this
 * every course deletion would orphan its lessons, enrollments, progress rows,
 * reviews, certificates, discussions and tag relations.
 *
 * Usage:
 *
 *   schema.plugin(cascadeDelete, {
 *     children: [
 *       { model: 'Lesson',     foreignKey: 'course' },
 *       { model: 'Enrollment', foreignKey: 'course' },
 *     ],
 *   });
 *
 * Children are deleted through their own model's `deleteMany`, so grandchildren
 * cascade too, as long as each level declares its own children.
 *
 * `onDelete: 'unset'` mirrors ON DELETE SET NULL (courses.category_id,
 * wallet_transactions.package_id / .course_id).
 */

const mongoose = require('mongoose');

/**
 * Collect the _ids matched by a delete query, before the documents disappear.
 * Needed because post-delete we no longer have anything to match children on.
 */
async function idsMatchedBy(Model, filter, session) {
    const docs = await Model.find(filter).select('_id').session(session || null).lean();
    return docs.map((d) => d._id);
}

/**
 * Delete the children of a set of parent ids.
 */
async function deleteChildren(children, parentIds, session) {
    if (!parentIds.length) return;

    for (const child of children) {
        const ChildModel = mongoose.model(child.model);
        const filter = { [child.foreignKey]: { $in: parentIds } };

        if (child.onDelete === 'unset') {
            // ON DELETE SET NULL equivalent — keep the row, drop the reference.
            await ChildModel.updateMany(
                filter,
                { $unset: { [child.foreignKey]: '' } },
                { session: session || undefined }
            );
            continue;
        }

        // Recurse through the child model's own hooks so grandchildren cascade.
        // deleteMany does not fire document middleware, so we resolve the ids
        // and let the child's registered cascade run against them.
        const childIds = await idsMatchedBy(ChildModel, filter, session);
        if (!childIds.length) continue;

        const grandchildren = ChildModel.schema.get('cascadeChildren') || [];
        if (grandchildren.length) {
            await deleteChildren(grandchildren, childIds, session);
        }

        await ChildModel.deleteMany({ _id: { $in: childIds } }, { session: session || undefined });
    }
}

/**
 * Mongoose plugin registering cascade behavior for a schema.
 */
function cascadeDelete(schema, options = {}) {
    const children = options.children || [];
    if (!children.length) return;

    // Stashed on the schema so nested cascades can discover it (see above).
    schema.set('cascadeChildren', children);

    // Query middleware — covers deleteOne/deleteMany/findOneAndDelete called on
    // the Model, which is how every controller actually deletes.
    const queryHooks = ['deleteOne', 'deleteMany', 'findOneAndDelete'];

    schema.pre(queryHooks, { query: true, document: false }, async function cascadePre(next) {
        try {
            const session = this.getOptions().session;
            const parentIds = await idsMatchedBy(this.model, this.getFilter(), session);
            // Carry the ids to the post hook; the docs are gone by then.
            this._cascadeParentIds = parentIds;
            next();
        } catch (err) {
            next(err);
        }
    });

    schema.post(queryHooks, { query: true, document: false }, async function cascadePost() {
        const parentIds = this._cascadeParentIds || [];
        const session = this.getOptions().session;
        await deleteChildren(children, parentIds, session);
    });

    // Document middleware — covers doc.deleteOne().
    schema.post('deleteOne', { document: true, query: false }, async function cascadeDoc() {
        const session = this.$session();
        await deleteChildren(children, [this._id], session);
    });
}

module.exports = { cascadeDelete, deleteChildren };
