/**
 * Judge0 execution adapter — the production path.
 *
 * Judge0 runs each submission in an isolated container with real CPU, memory,
 * process and network limits. That is the isolation the local adapter cannot
 * provide, and the reason this is the only adapter fit for untrusted users.
 *
 * Works with both hosted Judge0 (RapidAPI) and a self-hosted instance; the
 * only difference is whether the RapidAPI headers are sent.
 */

const LANGUAGE_IDS = {
    c: 50,          // GCC 9.2.0
    cpp: 54,        // G++ 9.2.0
    java: 62,       // OpenJDK 13
    python: 71,     // Python 3.8.1
    javascript: 63, // Node 12.14.0
};

/** Judge0 status id -> our vocabulary. */
const STATUS_MAP = {
    1: 'ok',                      // In Queue
    2: 'ok',                      // Processing
    3: 'ok',                      // Accepted
    4: 'ok',                      // Wrong Answer — grading is ours, not Judge0's
    5: 'time_limit_exceeded',
    6: 'compile_error',
    7: 'runtime_error',           // SIGSEGV
    8: 'runtime_error',           // SIGXFSZ
    9: 'runtime_error',           // SIGFPE
    10: 'runtime_error',          // SIGABRT
    11: 'runtime_error',          // NZEC
    12: 'runtime_error',
    13: 'internal_error',
    14: 'internal_error',
};

const isConfigured = () => Boolean(process.env.JUDGE0_API_URL && process.env.JUDGE0_API_KEY);

const supportedLanguages = () => Object.keys(LANGUAGE_IDS);

function headers() {
    const h = { 'Content-Type': 'application/json' };
    const host = process.env.JUDGE0_API_HOST;
    // RapidAPI needs these; a self-hosted instance ignores them.
    if (host) {
        h['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
        h['X-RapidAPI-Host'] = host;
    } else if (process.env.JUDGE0_API_KEY) {
        h['X-Auth-Token'] = process.env.JUDGE0_API_KEY;
    }
    return h;
}

const decode = (v) => (v ? Buffer.from(v, 'base64').toString('utf8') : '');

async function run({
    language,
    sourceCode,
    stdin = '',
    timeLimitSeconds = 5,
    memoryLimitKB = 128_000,
}) {
    if (!isConfigured()) {
        return {
            status: 'internal_error',
            stdout: '', stderr: '',
            compileOutput: 'Judge0 is not configured on this server.',
            runtimeMs: 0, memoryKB: null,
        };
    }

    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
        return {
            status: 'internal_error',
            stdout: '', stderr: '',
            compileOutput: `Unsupported language: ${language}`,
            runtimeMs: 0, memoryKB: null,
        };
    }

    const base = process.env.JUDGE0_API_URL.replace(/\/+$/, '');

    try {
        // base64_encoded keeps binary-ish output and unusual characters intact.
        const res = await fetch(`${base}/submissions?base64_encoded=true&wait=true`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                language_id: languageId,
                source_code: Buffer.from(sourceCode).toString('base64'),
                stdin: Buffer.from(stdin).toString('base64'),
                cpu_time_limit: timeLimitSeconds,
                memory_limit: memoryLimitKB,
                // Defence in depth even though Judge0 already isolates.
                enable_network: false,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return {
                status: 'internal_error',
                stdout: '', stderr: '',
                compileOutput: `Judge0 returned ${res.status}. ${body.slice(0, 200)}`,
                runtimeMs: 0, memoryKB: null,
            };
        }

        const data = await res.json();
        const statusId = data.status?.id;
        let status = STATUS_MAP[statusId] || 'internal_error';

        // Judge0 reports OOM as a runtime error; reclassify from the message.
        const stderr = decode(data.stderr);
        if (status === 'runtime_error' && /memory/i.test(stderr)) {
            status = 'memory_limit_exceeded';
        }

        return {
            status,
            stdout: decode(data.stdout),
            stderr,
            compileOutput: decode(data.compile_output) || null,
            // Judge0 reports seconds; we speak milliseconds throughout.
            runtimeMs: data.time ? Math.round(parseFloat(data.time) * 1000) : null,
            memoryKB: data.memory ?? null,
        };
    } catch (err) {
        return {
            status: 'internal_error',
            stdout: '', stderr: '',
            compileOutput: `Could not reach Judge0: ${err.message}`,
            runtimeMs: 0, memoryKB: null,
        };
    }
}

module.exports = {
    name: 'judge0',
    isSandboxed: true,
    run,
    supportedLanguages,
    isConfigured,
    LANGUAGE_IDS,
};
