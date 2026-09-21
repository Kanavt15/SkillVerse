/**
 * Local execution adapter — DEVELOPMENT ONLY.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  THIS IS NOT A SECURITY SANDBOX.                                     │
 * │                                                                      │
 * │  Code runs as a child process under YOUR user account, with YOUR     │
 * │  filesystem and network access. A hostile program can read your      │
 * │  files, open sockets and spawn processes. The protections below      │
 * │  (wall-clock timeout, output caps, isolated temp dir, scrubbed env)  │
 * │  guard against RUNAWAY code, not MALICIOUS code.                     │
 * │                                                                      │
 * │  It exists so the Practice Arena works on a developer machine with   │
 * │  no Judge0 key and no Docker. Anything with untrusted users must     │
 * │  use Judge0 or an equivalent isolated runner.                        │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Real isolation needs OS-level containment — containers, seccomp, cgroups —
 * which is exactly what Judge0 provides and what cannot be approximated with
 * `child_process` alone, least of all portably on Windows.
 */

const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MAX_OUTPUT_BYTES = 64 * 1024;
const COMPILE_TIMEOUT_MS = 20_000;

/**
 * How to build and run each language.
 * `compile` is optional; `run` receives the working directory.
 */
const RUNNERS = {
    javascript: {
        file: 'main.js',
        probe: ['node', ['--version']],
        // Cap the heap so an allocation loop fails fast instead of swapping.
        run: (dir, mem) => ['node', [`--max-old-space-size=${Math.floor(mem / 1024)}`, path.join(dir, 'main.js')]],
    },
    python: {
        file: 'main.py',
        probe: ['python', ['--version']],
        // -I isolates: ignores PYTHON* env vars and the user site directory.
        run: (dir) => ['python', ['-I', '-B', path.join(dir, 'main.py')]],
    },
    java: {
        file: 'Main.java',
        probe: ['javac', ['-version']],
        compile: (dir) => ['javac', ['-nowarn', path.join(dir, 'Main.java')]],
        run: (dir, mem) => ['java', [`-Xmx${Math.floor(mem / 1024)}m`, '-cp', dir, 'Main']],
    },
};

/** Cache of which runtimes are actually installed. */
let availability = null;

function probeOnce(cmd, args) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { stdio: 'ignore', shell: false });
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
        setTimeout(() => { child.kill(); resolve(false); }, 5000).unref();
    });
}

async function detectAvailability() {
    if (availability) return availability;
    const found = {};
    await Promise.all(Object.entries(RUNNERS).map(async ([lang, cfg]) => {
        found[lang] = await probeOnce(cfg.probe[0], cfg.probe[1]);
    }));
    availability = found;
    return found;
}

/** Synchronous view of the cache, for the descriptor. */
function supportedLanguages() {
    if (!availability) {
        // Kick off detection; first call may under-report until it resolves.
        detectAvailability().catch(() => {});
        return Object.keys(RUNNERS);
    }
    return Object.keys(RUNNERS).filter((l) => availability[l]);
}

/**
 * Spawn a command, capture bounded output, and kill it on timeout.
 */
function execute(cmd, args, { cwd, stdin = '', timeoutMs }) {
    return new Promise((resolve) => {
        const started = Date.now();

        const child = spawn(cmd, args, {
            cwd,
            shell: false,
            windowsHide: true,
            // Scrubbed environment — the program should not inherit API keys,
            // database URIs or anything else from the API process.
            env: {
                PATH: process.env.PATH,
                SYSTEMROOT: process.env.SYSTEMROOT,
                TEMP: cwd,
                TMP: cwd,
                HOME: cwd,
            },
        });

        let stdout = Buffer.alloc(0);
        let stderr = Buffer.alloc(0);
        let truncated = false;
        let timedOut = false;
        let settled = false;

        const append = (buf, chunk) => {
            if (buf.length >= MAX_OUTPUT_BYTES) { truncated = true; return buf; }
            const next = Buffer.concat([buf, chunk]);
            if (next.length > MAX_OUTPUT_BYTES) {
                truncated = true;
                return next.subarray(0, MAX_OUTPUT_BYTES);
            }
            return next;
        };

        child.stdout.on('data', (c) => { stdout = append(stdout, c); });
        child.stderr.on('data', (c) => { stderr = append(stderr, c); });

        const timer = setTimeout(() => {
            timedOut = true;
            // SIGKILL, not SIGTERM: a program in a tight loop may never
            // service a catchable signal.
            child.kill('SIGKILL');
        }, timeoutMs);

        const finish = (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({
                code,
                timedOut,
                truncated,
                stdout: stdout.toString('utf8'),
                stderr: stderr.toString('utf8'),
                runtimeMs: Date.now() - started,
            });
        };

        child.on('close', finish);
        child.on('error', (err) => {
            stderr = Buffer.from(String(err.message));
            finish(-1);
        });

        if (stdin) {
            child.stdin.write(stdin);
        }
        child.stdin.end();
        // EPIPE if the program exits without reading stdin — not an error.
        child.stdin.on('error', () => {});
    });
}

async function run({
    language,
    sourceCode,
    stdin = '',
    timeLimitSeconds = 5,
    memoryLimitKB = 128_000,
}) {
    const cfg = RUNNERS[language];
    if (!cfg) {
        return {
            status: 'internal_error',
            stdout: '', stderr: '',
            compileOutput: `Language "${language}" is not available on this server.`
                + ' Configure Judge0 to run C, C++ or other languages.',
            runtimeMs: 0, memoryKB: null,
        };
    }

    const have = await detectAvailability();
    if (!have[language]) {
        return {
            status: 'internal_error',
            stdout: '', stderr: '',
            compileOutput: `No ${language} runtime is installed on this server.`,
            runtimeMs: 0, memoryKB: null,
        };
    }

    // Each run gets a private directory, used as cwd, TEMP and HOME.
    const dir = path.join(os.tmpdir(), `sv-exec-${crypto.randomBytes(8).toString('hex')}`);
    await fs.mkdir(dir, { recursive: true });

    try {
        await fs.writeFile(path.join(dir, cfg.file), sourceCode, 'utf8');

        if (cfg.compile) {
            const [cmd, args] = cfg.compile(dir);
            const compiled = await execute(cmd, args, { cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS });

            if (compiled.code !== 0) {
                return {
                    status: 'compile_error',
                    stdout: '', stderr: '',
                    compileOutput: (compiled.stderr || compiled.stdout || 'Compilation failed.')
                        .replaceAll(dir, ''),   // don't leak server paths
                    runtimeMs: compiled.runtimeMs,
                    memoryKB: null,
                };
            }
        }

        const [cmd, args] = cfg.run(dir, memoryLimitKB);
        const result = await execute(cmd, args, {
            cwd: dir,
            stdin,
            timeoutMs: Math.max(1, timeLimitSeconds) * 1000,
        });

        if (result.timedOut) {
            return {
                status: 'time_limit_exceeded',
                stdout: result.stdout, stderr: '',
                compileOutput: null,
                runtimeMs: result.runtimeMs,
                memoryKB: null,
            };
        }

        if (result.code !== 0) {
            const stderr = result.stderr.replaceAll(dir, '');
            // Heap exhaustion surfaces as an ordinary non-zero exit; name it
            // properly so the learner sees "memory limit", not "runtime error".
            const looksLikeOOM = /heap out of memory|OutOfMemoryError|MemoryError/i.test(stderr);
            return {
                status: looksLikeOOM ? 'memory_limit_exceeded' : 'runtime_error',
                stdout: result.stdout,
                stderr,
                compileOutput: null,
                runtimeMs: result.runtimeMs,
                memoryKB: null,
            };
        }

        return {
            status: 'ok',
            stdout: result.truncated
                ? `${result.stdout}\n... output truncated at 64 KB`
                : result.stdout,
            stderr: '',
            compileOutput: null,
            runtimeMs: result.runtimeMs,
            memoryKB: null,   // not measurable without OS-level accounting
        };
    } catch (err) {
        return {
            status: 'internal_error',
            stdout: '', stderr: '',
            compileOutput: `Execution failed: ${err.message}`,
            runtimeMs: 0, memoryKB: null,
        };
    } finally {
        // Always clean up, including after a timeout kill.
        fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
}

module.exports = {
    name: 'local',
    isSandboxed: false,
    run,
    supportedLanguages,
    detectAvailability,
};
