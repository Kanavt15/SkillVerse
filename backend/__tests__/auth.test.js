/**
 * Phase C1 verification — auth ported to MongoDB.
 *
 * Exercises the controllers through real Express routing so the middleware
 * chain (sanitizer, validators, auth guard) is covered too, not just the
 * handler bodies.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const db = require('./helpers/db');
const { sanitizeInput, securityLogger } = require('../middleware/security.middleware');
const { User, WalletTransaction, RefreshToken, PlatformSettings } = require('../models');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest-only';

/** Mount the real routers on a bare app, mirroring server.js middleware order. */
const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(securityLogger);
    app.use(sanitizeInput);
    app.use('/api/auth', require('../routes/auth.routes'));
    app.use('/api/users', require('../routes/user.routes'));
    // Mirrors the production handler: never echo 5xx internals.
    app.use((err, req, res, _next) => {
        const status = err.status || 500;
        res.status(status).json({
            success: false,
            message: status < 500 ? err.message : 'Internal Server Error',
        });
    });
    return app;
};

let app;

beforeAll(async () => {
    await db.connect();
    app = makeApp();
}, 120000);
afterAll(async () => { await db.disconnect(); });
afterEach(async () => { await db.clear(); });

const VALID = {
    email: 'learner@example.com',
    password: 'Str0ng!Pass',
    full_name: 'Test Learner',
};

const registerUser = (over = {}) => request(app).post('/api/auth/register').send({ ...VALID, ...over });

describe('POST /api/auth/register', () => {
    it('creates an account and returns a session', async () => {
        const res = await registerUser();

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeTruthy();
        expect(res.body.user.email).toBe(VALID.email);
        expect(res.body.user.full_name).toBe('Test Learner');
        // Refresh token is delivered as an httpOnly cookie, never in the body.
        expect(res.body.refreshToken).toBeUndefined();
        expect(res.headers['set-cookie'].join(';')).toMatch(/refreshToken=.*HttpOnly/i);
    });

    it('starts every account as a locked-out learner', async () => {
        const res = await registerUser();
        expect(res.body.user.role).toBe('learner');
        expect(res.body.user.canTeach).toBe(false);
        expect(res.body.user.teaching.isEligible).toBe(false);
        expect(res.body.user.level).toBe(1);
        expect(res.body.user.xp).toBe(0);

        const stored = await User.findOne({ email: VALID.email });
        expect(stored.role).toBe('user');
    });

    it('IGNORES an attempt to self-assign a privileged role', async () => {
        // The old endpoint honored this field, so anyone could register
        // straight into 'instructor' — or 'both', which bypassed authorize().
        const res = await registerUser({ role: 'both' });
        expect(res.status).toBe(201);

        const stored = await User.findOne({ email: VALID.email });
        expect(stored.role).toBe('user');
        expect(stored.teaching.isEligible).toBe(false);
    });

    it('grants the welcome bonus atomically with the ledger entry', async () => {
        await registerUser();

        const settings = await PlatformSettings.getSettings(true);
        const user = await User.findOne({ email: VALID.email });
        const ledger = await WalletTransaction.find({ user: user._id });

        expect(user.wallet.balance).toBe(settings.registrationWelcomeBonus);
        // The MySQL version wrote these in two unrelated statements.
        expect(ledger).toHaveLength(1);
        expect(ledger[0].source).toBe('welcome_bonus');
        expect(ledger[0].balanceAfter).toBe(user.wallet.balance);
    });

    it('derives a username when none is supplied', async () => {
        const res = await registerUser();
        expect(res.body.user.username).toBe('learner');
    });

    it('does not reveal whether an email is already registered', async () => {
        await registerUser();
        const res = await registerUser({ full_name: 'Someone Else' });

        expect(res.status).toBe(400);
        // Generic on purpose — a specific message is an enumeration oracle.
        expect(res.body.message).toBe('Registration failed. Please try a different email.');
    });

    it('rejects weak passwords', async () => {
        const res = await registerUser({ password: 'weak' });
        expect(res.status).toBe(400);
        expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('rejects a duplicate username', async () => {
        await registerUser({ username: 'coder' });
        const res = await registerUser({ email: 'other@example.com', username: 'coder' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/username/i);
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(async () => { await registerUser(); });

    it('signs in with correct credentials', async () => {
        const res = await request(app).post('/api/auth/login')
            .send({ email: VALID.email, password: VALID.password });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeTruthy();
        expect(res.body.user.password).toBeUndefined();
    });

    it('rejects a wrong password', async () => {
        const res = await request(app).post('/api/auth/login')
            .send({ email: VALID.email, password: 'Wr0ng!Pass' });
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('gives the same answer for an unknown email', async () => {
        const res = await request(app).post('/api/auth/login')
            .send({ email: 'nobody@example.com', password: VALID.password });
        expect(res.status).toBe(401);
        // Identical to the wrong-password reply, so neither is distinguishable.
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('resists a NoSQL operator-injection login bypass', async () => {
        // Against Mongoose, findOne({email:{$gt:''}}) would match the first
        // user in the collection. The sanitizer strips the operator key.
        const res = await request(app).post('/api/auth/login')
            .send({ email: { $gt: '' }, password: { $gt: '' } });

        expect(res.status).not.toBe(200);
        expect(res.body.accessToken).toBeUndefined();
    });

    it('refuses a suspended account', async () => {
        await User.updateOne({ email: VALID.email }, { $set: { isSuspended: true } });
        const res = await request(app).post('/api/auth/login')
            .send({ email: VALID.email, password: VALID.password });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SUSPENDED');
    });
});

describe('refresh token rotation', () => {
    const loginAndGetCookie = async () => {
        await registerUser();
        const res = await request(app).post('/api/auth/login')
            .send({ email: VALID.email, password: VALID.password });
        return res.headers['set-cookie'];
    };

    it('issues a new access token and rotates the refresh cookie', async () => {
        const cookie = await loginAndGetCookie();
        const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeTruthy();
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('revokes the compromised family when a rotated token is replayed', async () => {
        const cookie = await loginAndGetCookie();
        const rawToken = /refreshToken=([^;]+)/.exec(cookie.join(';'))[1];
        const { hashToken } = require('../utils/token.utils');
        const { familyId } = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });

        // First use succeeds and rotates.
        await request(app).post('/api/auth/refresh').set('Cookie', cookie);
        // Replaying the retired token means it leaked.
        const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

        expect(replay.status).toBe(401);
        expect(replay.body.message).toMatch(/reuse detected/i);

        // Every token in the compromised chain is dead — attacker and victim
        // alike, since we cannot tell which one replayed it.
        expect(await RefreshToken.countDocuments({ familyId, isRevoked: false })).toBe(0);
    });

    it('leaves the user\'s OTHER sessions alone', async () => {
        // Registration opens session A; login opens session B.
        await registerUser();
        const loginRes = await request(app).post('/api/auth/login')
            .send({ email: VALID.email, password: VALID.password });
        const cookieB = loginRes.headers['set-cookie'];

        await request(app).post('/api/auth/refresh').set('Cookie', cookieB);
        await request(app).post('/api/auth/refresh').set('Cookie', cookieB);

        // Theft detection must be scoped to the leaked chain. Signing a user
        // out of every device because one phone was compromised is its own
        // kind of outage.
        const survivors = await RefreshToken.countDocuments({ isRevoked: false });
        expect(survivors).toBe(1);
    });

    it('rejects a request with no refresh cookie', async () => {
        const res = await request(app).post('/api/auth/refresh');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('NO_REFRESH_TOKEN');
    });

    it('stores only the hash, never the token itself', async () => {
        const cookie = await loginAndGetCookie();
        const raw = /refreshToken=([^;]+)/.exec(cookie.join(';'))[1];

        expect(await RefreshToken.findOne({ tokenHash: raw })).toBeNull();
        expect(await RefreshToken.countDocuments()).toBeGreaterThan(0);
    });
});

describe('profile', () => {
    const authed = async () => {
        const reg = await registerUser();
        return reg.body.accessToken;
    };

    it('requires a token', async () => {
        const res = await request(app).get('/api/auth/profile');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('NO_TOKEN');
    });

    it('returns the signed-in user', async () => {
        const token = await authed();
        const res = await request(app).get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(VALID.email);
    });

    it('updates name and bio', async () => {
        const token = await authed();
        const res = await request(app).put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ full_name: 'Renamed Learner', bio: 'I learn things' });

        expect(res.status).toBe(200);
        expect(res.body.user.full_name).toBe('Renamed Learner');
        expect(res.body.user.bio).toBe('I learn things');
    });

    it('REFUSES to let a user promote themselves to instructor', async () => {
        const token = await authed();
        // This exact request used to work: PUT role:'instructor' (or 'both',
        // which then passed every authorize() check in the app).
        const res = await request(app).put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ role: 'both' });

        // No recognized field -> nothing to update.
        expect(res.status).toBe(400);

        const stored = await User.findOne({ email: VALID.email });
        expect(stored.role).toBe('user');
        expect(stored.teaching.isEligible).toBe(false);
    });

    it('ignores role even alongside legitimate fields', async () => {
        const token = await authed();
        await request(app).put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ full_name: 'Sneaky', role: 'admin' });

        const stored = await User.findOne({ email: VALID.email });
        expect(stored.fullName).toBe('Sneaky');
        expect(stored.role).toBe('user');
    });
});

describe('GET /api/users/:id', () => {
    it('exposes only public fields', async () => {
        const reg = await registerUser();
        const userId = reg.body.user.id;

        const res = await request(app).get(`/api/users/${userId}`);

        expect(res.status).toBe(200);
        expect(res.body.user.full_name).toBe('Test Learner');
        // The MySQL route returned the raw row, leaking these on a public URL.
        expect(res.body.user.email).toBeUndefined();
        expect(res.body.user.points).toBeUndefined();
        expect(res.body.user.wallet).toBeUndefined();
    });

    it('400s on a malformed id instead of throwing a cast error', async () => {
        const res = await request(app).get('/api/users/not-an-objectid');
        expect(res.status).toBe(400);
    });

    it('404s on an unknown id', async () => {
        const res = await request(app).get('/api/users/507f1f77bcf86cd799439011');
        expect(res.status).toBe(404);
    });
});
