/**
 * Tests for the NoSQL-injection defense added ahead of the MongoDB migration.
 *
 * The original sanitizer rewrote values but preserved keys verbatim, which was
 * harmless against parameterized MySQL and an auth bypass against Mongoose.
 */

const {
    sanitizeInput,
    stripOperatorKeys,
} = require('../middleware/security.middleware');

/** Minimal Express req/res/next doubles. */
const makeReq = (overrides = {}) => ({
    body: {},
    query: {},
    params: {},
    path: '/api/auth/login',
    method: 'POST',
    logSecurity: jest.fn(),
    ...overrides,
});

const run = (req) => {
    const next = jest.fn();
    sanitizeInput(req, {}, next);
    return next;
};

describe('stripOperatorKeys', () => {
    it('removes $-prefixed keys at the top level', () => {
        const obj = { email: { $gt: '' } };
        stripOperatorKeys(obj);
        expect(obj.email).toEqual({});
    });

    it('removes $-prefixed keys when nested', () => {
        const obj = { filter: { user: { $ne: null } } };
        stripOperatorKeys(obj);
        expect(obj.filter.user).toEqual({});
    });

    it('removes dotted keys that reach into subdocuments', () => {
        const obj = { 'teaching.isEligible': true, name: 'ok' };
        stripOperatorKeys(obj);
        expect(obj).toEqual({ name: 'ok' });
    });

    it('walks arrays', () => {
        const obj = { items: [{ $where: 'sleep(1000)' }, { safe: 1 }] };
        stripOperatorKeys(obj);
        expect(obj.items[0]).toEqual({});
        expect(obj.items[1]).toEqual({ safe: 1 });
    });

    it('leaves legitimate payloads untouched', () => {
        const obj = { email: 'a@b.com', price: 100, tags: ['x', 'y'] };
        const copy = JSON.parse(JSON.stringify(obj));
        stripOperatorKeys(obj);
        expect(obj).toEqual(copy);
    });

    it('stops recursing on pathologically nested input', () => {
        let deep = {};
        let cursor = deep;
        for (let i = 0; i < 100; i += 1) {
            cursor.next = {};
            cursor = cursor.next;
        }
        expect(() => stripOperatorKeys(deep)).not.toThrow();
    });
});

describe('sanitizeInput', () => {
    it('neutralizes a {$gt:""} login bypass attempt', () => {
        const req = makeReq({ body: { email: { $gt: '' }, password: { $gt: '' } } });
        run(req);
        // Nothing left that Mongoose would read as an operator.
        expect(req.body.email).toEqual({});
        expect(req.body.password).toEqual({});
        expect(req.logSecurity).toHaveBeenCalledWith(
            'SUSPICIOUS',
            expect.objectContaining({ reason: 'nosql_operator_key' })
        );
    });

    it('strips operator keys from query and params too', () => {
        const req = makeReq({
            query: { sort: { $where: '1==1' } },
            params: { id: { $ne: null } },
        });
        run(req);
        expect(req.query.sort).toEqual({});
        expect(req.params.id).toEqual({});
    });

    it('still strips XSS from ordinary bodies', () => {
        const req = makeReq({ body: { bio: '<script>alert(1)</script>hello' } });
        run(req);
        expect(req.body.bio).not.toContain('<script>');
        expect(req.body.bio).toContain('hello');
    });

    it('calls next()', () => {
        const next = run(makeReq());
        expect(next).toHaveBeenCalled();
    });
});

describe('sanitizeInput on code-carrying routes', () => {
    it('preserves C++ source that value-sanitization would corrupt', () => {
        const source = '#include <iostream>\nvector<int> v;\nif (a < b) return 1;';
        const req = makeReq({ path: '/api/submissions', body: { code: source } });
        run(req);
        // Angle brackets must survive or the judge gets uncompilable input.
        expect(req.body.code).toBe(source);
    });

    it('still strips operator keys on those routes', () => {
        const req = makeReq({
            path: '/api/submissions',
            body: { code: 'print(1)', problem: { $ne: null } },
        });
        run(req);
        expect(req.body.problem).toEqual({});
        expect(req.body.code).toBe('print(1)');
    });

    it('does not exempt ordinary routes from value sanitization', () => {
        const source = 'vector<int> v;';
        const req = makeReq({ path: '/api/courses', body: { description: source } });
        run(req);
        expect(req.body.description).not.toBe(source);
    });
});
