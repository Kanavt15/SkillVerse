/**
 * Code execution — adapter selection.
 *
 * User code is NEVER executed in the API process. Every adapter runs it
 * somewhere else: Judge0 runs it on an isolated worker, the local adapter runs
 * it in a separate short-lived child process.
 *
 * Adapter is chosen by EXECUTION_ENGINE:
 *   judge0  — production. Real isolation, all five languages.
 *   local   — development only. See the warning in local.adapter.js.
 *   auto    — judge0 when a key is configured, else local (default).
 *
 * Swapping in a self-hosted judge later means writing one more adapter with
 * the same `run()` shape; nothing above this layer changes.
 */

const judge0 = require('./judge0.adapter');
const local = require('./local.adapter');

const ENGINE = (process.env.EXECUTION_ENGINE || 'auto').toLowerCase();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Which adapter is active, and why. */
function resolveAdapter() {
    if (ENGINE === 'judge0') return judge0;
    if (ENGINE === 'local') {
        if (IS_PRODUCTION && process.env.ALLOW_LOCAL_EXECUTION !== 'true') {
            throw new Error(
                'The local execution adapter is not a security sandbox and is refused in '
                + 'production. Configure Judge0, or set ALLOW_LOCAL_EXECUTION=true if you '
                + 'genuinely accept the risk.'
            );
        }
        return local;
    }

    // auto
    if (judge0.isConfigured()) return judge0;
    if (IS_PRODUCTION) {
        throw new Error(
            'No code execution engine is configured. Set JUDGE0_API_URL and JUDGE0_API_KEY.'
        );
    }
    return local;
}

/**
 * Run one program against one input.
 *
 * @param {object} opts
 * @param {string} opts.language   - 'javascript' | 'python' | 'java' | 'c' | 'cpp'
 * @param {string} opts.sourceCode
 * @param {string} [opts.stdin]
 * @param {number} [opts.timeLimitSeconds]
 * @param {number} [opts.memoryLimitKB]
 * @returns {Promise<{status, stdout, stderr, compileOutput, runtimeMs, memoryKB}>}
 *
 * `status` is one of: ok | compile_error | runtime_error | time_limit_exceeded
 *          | memory_limit_exceeded | internal_error
 * Deciding pass/fail is the grader's job, not the runner's.
 */
async function run(opts) {
    const adapter = resolveAdapter();
    return adapter.run(opts);
}

/** Languages the active adapter can actually execute right now. */
function supportedLanguages() {
    try {
        return resolveAdapter().supportedLanguages();
    } catch {
        return [];
    }
}

/** Surfaced by the health endpoint and the Arena UI. */
function describe() {
    let adapter;
    try {
        adapter = resolveAdapter();
    } catch (err) {
        return { engine: 'none', ready: false, reason: err.message, languages: [] };
    }

    return {
        engine: adapter.name,
        ready: true,
        isSandboxed: adapter.isSandboxed,
        languages: adapter.supportedLanguages(),
    };
}

module.exports = { run, supportedLanguages, describe, resolveAdapter };
