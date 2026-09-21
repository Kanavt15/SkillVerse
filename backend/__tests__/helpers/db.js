/**
 * In-memory MongoDB for tests.
 *
 * Started as a single-node REPLICA SET, not a standalone. SkillVerse depends on
 * multi-document transactions for enrollment, lesson completion and payments,
 * and those throw against a standalone mongod — so a standalone test server
 * would pass every unit test and still not exercise the paths that matter.
 */

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet = null;

const connect = async () => {
    replSet = await MongoMemoryReplSet.create({
        // Pinned for reproducibility across machines and CI.
        //
        // Also note mongodb-memory-server is held at ^10.x on purpose: 11.x
        // bundles its own mongodb 7.x driver alongside the 6.x one Mongoose
        // uses, and the duplicate fails the handshake under Jest with
        // "Missing required sub-document 'driver'". 10.x dedupes to a single
        // driver. Don't bump it without re-running this suite.
        binary: { version: '7.0.14' },
        replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replSet.getUri());
    // Register every schema and build the indexes the tests assert on.
    require('../../models');
    await Promise.all(
        Object.values(mongoose.models).map((M) => M.createIndexes())
    );
};

const disconnect = async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
};

/** Wipe every collection between tests without paying to rebuild indexes. */
const clear = async () => {
    const { collections } = mongoose.connection;
    await Promise.all(
        Object.values(collections).map((c) => c.deleteMany({}))
    );

    // PlatformSettings memoizes the singleton in module scope for the hot XP
    // path. That cache outlives the wipe, so without this the next test reads a
    // document that no longer exists and writes to it land nowhere.
    mongoose.models.PlatformSettings?.invalidateCache?.();
};

module.exports = { connect, disconnect, clear };
