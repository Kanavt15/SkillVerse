/**
 * MongoDB connection layer for SkillVerse.
 *
 * Replaces the MySQL pool in config/database.js. The two coexist during the
 * migration: controllers are ported domain by domain (Phase C), and database.js
 * is deleted once the last one moves over.
 *
 * NOTE ON TRANSACTIONS: MongoDB multi-document transactions require a replica
 * set. They do NOT work against a standalone mongod. SkillVerse depends on them
 * for enrollment, lesson completion and payments, so connect() probes for
 * replica-set support at startup and warns loudly if it is missing — that is far
 * easier to diagnose here than as an "Illegal operation" deep inside a checkout.
 */

const mongoose = require('mongoose');
require('dotenv').config();

let isConnected = false;
let supportsTransactions = false;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillverse';

const CONNECT_OPTIONS = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
};

/**
 * Ask the server whether it is a replica set / mongos. Transactions need one.
 */
const probeTransactionSupport = async () => {
    try {
        const admin = mongoose.connection.db.admin();
        const info = await admin.command({ hello: 1 });
        // `setName` is present on replica set members; `msg: 'isdbgrid'` marks a mongos.
        return Boolean(info.setName) || info.msg === 'isdbgrid';
    } catch (err) {
        console.error('⚠️  Could not probe transaction support:', err.message);
        return false;
    }
};

/**
 * Connect to MongoDB. Resolves true on success, false on failure.
 */
const connect = async (uri = MONGODB_URI) => {
    try {
        mongoose.set('strictQuery', true);

        // Surface slow/failed queries in development rather than swallowing them.
        if (process.env.NODE_ENV !== 'production' && process.env.MONGO_DEBUG === 'true') {
            mongoose.set('debug', true);
        }

        await mongoose.connect(uri, CONNECT_OPTIONS);
        isConnected = true;

        const { host, port, name } = mongoose.connection;
        console.log(`✅ MongoDB connected: ${host}:${port}/${name}`);

        supportsTransactions = await probeTransactionSupport();
        if (supportsTransactions) {
            console.log('🔒 Transactions: supported (replica set detected)');
        } else {
            console.error(
                '❌ Transactions: UNSUPPORTED — this is a standalone mongod.\n' +
                '   Enrollment, lesson completion and payments REQUIRE a replica set.\n' +
                '   Fix: start mongod with --replSet rs0 and run rs.initiate(), or use MongoDB Atlas.'
            );
        }

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB error:', err.message);
        });
        mongoose.connection.on('disconnected', () => {
            isConnected = false;
            console.warn('⚠️  MongoDB disconnected');
        });
        mongoose.connection.on('reconnected', () => {
            isConnected = true;
            console.log('✅ MongoDB reconnected');
        });

        return true;
    } catch (err) {
        isConnected = false;
        console.error('❌ MongoDB connection failed:', err.message);
        return false;
    }
};

/**
 * Run `fn` inside a transaction, passing the session through.
 *
 * Every port in Phase C should use this instead of hand-rolling
 * startSession/commit/abort, so the abort-outside-transaction footgun that
 * exists in the MySQL code (rollback called where no transaction started)
 * cannot be reproduced.
 *
 *   const result = await withTransaction(async (session) => {
 *     await Doc.create([{ ... }], { session });
 *     return something;
 *   });
 *
 * Remember: EVERY operation inside must be passed { session } or it runs
 * outside the transaction and will not roll back.
 */
const withTransaction = async (fn) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await fn(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

const isHealthy = () => isConnected && mongoose.connection.readyState === 1;

const hasTransactionSupport = () => supportsTransactions;

/**
 * Probe the server with a ping. Used by the health endpoint.
 */
const ping = async () => {
    try {
        await mongoose.connection.db.admin().ping();
        return true;
    } catch {
        return false;
    }
};

const close = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        isConnected = false;
        console.log('🔌 MongoDB connection closed');
    }
};

module.exports = {
    connect,
    close,
    ping,
    isHealthy,
    hasTransactionSupport,
    withTransaction,
    mongoose,
};
