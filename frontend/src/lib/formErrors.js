/**
 * Form validation and API error helpers.
 *
 * Both exist because the forms and the API disagreed about what a valid
 * password is, and the forms then hid the server's explanation.
 */

/**
 * Password rules, mirroring `registerValidation` in
 * backend/routes/auth.routes.js exactly.
 *
 * Keep these in sync. A client rule that is LOOSER than the server's produces
 * the worst possible outcome: the form accepts the input, the request fails,
 * and the user is told only that something went wrong.
 */
const PASSWORD_RULES = [
    { test: (p) => p.length >= 8, label: 'be at least 8 characters' },
    { test: (p) => /[A-Z]/.test(p), label: 'include an uppercase letter' },
    { test: (p) => /[a-z]/.test(p), label: 'include a lowercase letter' },
    { test: (p) => /[0-9]/.test(p), label: 'include a number' },
    { test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: 'include a special character' },
];

/** Every rule the password fails, as human-readable phrases. */
export function passwordProblems(password = '') {
    return PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
}

/** True when the password satisfies every server-side rule. */
export function isPasswordValid(password = '') {
    return passwordProblems(password).length === 0;
}

/** Per-rule state, for live feedback under the password field. */
export function passwordChecklist(password = '') {
    return PASSWORD_RULES.map((r) => ({ label: r.label, met: r.test(password) }));
}

/**
 * Pull a usable message out of an axios error.
 *
 * The API answers validation failures with `{ success: false, errors: [...] }`
 * and has no `message` field, so reading `data.message` alone always fell
 * through to the generic fallback — the server's actual explanation was
 * fetched, then discarded.
 */
export function readApiError(err, fallback = 'Something went wrong. Please try again.') {
    const data = err?.response?.data;
    if (!data) {
        // No response at all — the request never reached the server.
        return err?.request ? 'Cannot reach the server. Is the API running?' : fallback;
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
        // De-duplicate: one weak password trips several rules at once, and
        // repeating the field name for each is noise.
        const messages = [...new Set(data.errors.map((e) => e.msg).filter(Boolean))];
        if (messages.length) return messages.join(' ');
    }

    return data.message || fallback;
}
