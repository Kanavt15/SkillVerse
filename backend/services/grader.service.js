/**
 * Submission grading.
 *
 * Runs a submission against a problem's test cases and decides a verdict.
 * The execution adapter reports only how the program terminated; deciding
 * whether the OUTPUT is right is this module's job, so the rule lives in one
 * place rather than being reimplemented per adapter.
 */

const execution = require('./execution');

/**
 * Compare program output to the expected answer.
 *
 * Deliberately forgiving about whitespace that no learner intends to control:
 * trailing spaces on a line, and a missing or extra final newline. It is NOT
 * forgiving about the values themselves or their order. Judging "7 " as wrong
 * because of a trailing space teaches nothing.
 */
function outputMatches(actual, expected) {
    const normalize = (s) => String(s ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n+$/, '');

    return normalize(actual) === normalize(expected);
}

/** Runner status -> submission verdict, when a case did not simply run. */
const FAILURE_VERDICT = {
    compile_error: 'compilation_error',
    runtime_error: 'runtime_error',
    time_limit_exceeded: 'time_limit_exceeded',
    memory_limit_exceeded: 'memory_limit_exceeded',
    internal_error: 'internal_error',
};

/**
 * Grade a submission.
 *
 * Stops at the first failing case — the learner only needs the first thing
 * that went wrong, and there is no reason to spend judge time on the rest.
 *
 * @returns {{verdict, testResults, passedCount, totalCount, runtimeMs,
 *            memoryKB, stderr, compileOutput}}
 */
async function grade({ problem, language, sourceCode }) {
    const cases = [...(problem.testCases || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (cases.length === 0) {
        return {
            verdict: 'internal_error',
            testResults: [],
            passedCount: 0,
            totalCount: 0,
            runtimeMs: null,
            memoryKB: null,
            stderr: null,
            compileOutput: 'This problem has no test cases yet.',
        };
    }

    const testResults = [];
    let passedCount = 0;
    let maxRuntime = 0;
    let maxMemory = null;

    for (const [index, testCase] of cases.entries()) {
        /* eslint-disable no-await-in-loop */
        const result = await execution.run({
            language,
            sourceCode,
            stdin: testCase.input,
            timeLimitSeconds: problem.timeLimitSeconds || 5,
            memoryLimitKB: problem.memoryLimitKB || 128_000,
        });
        /* eslint-enable no-await-in-loop */

        maxRuntime = Math.max(maxRuntime, result.runtimeMs || 0);
        if (result.memoryKB != null) {
            maxMemory = Math.max(maxMemory ?? 0, result.memoryKB);
        }

        // The program did not finish normally — no point comparing output.
        if (result.status !== 'ok') {
            testResults.push({
                order: testCase.order ?? index + 1,
                passed: false,
                isHidden: testCase.isHidden,
                input: testCase.isHidden ? null : testCase.input,
                expectedOutput: testCase.isHidden ? null : testCase.expectedOutput,
                actualOutput: testCase.isHidden ? null : result.stdout,
                runtimeMs: result.runtimeMs,
                memoryKB: result.memoryKB,
            });

            return {
                verdict: FAILURE_VERDICT[result.status] || 'internal_error',
                testResults,
                passedCount,
                totalCount: cases.length,
                runtimeMs: maxRuntime,
                memoryKB: maxMemory,
                stderr: truncate(result.stderr),
                compileOutput: truncate(result.compileOutput),
            };
        }

        const passed = outputMatches(result.stdout, testCase.expectedOutput);
        if (passed) passedCount += 1;

        testResults.push({
            order: testCase.order ?? index + 1,
            passed,
            isHidden: testCase.isHidden,
            // Hidden cases never echo their data back, even on failure —
            // otherwise the whole suite could be reconstructed by submitting
            // deliberately wrong answers.
            input: testCase.isHidden ? null : testCase.input,
            expectedOutput: testCase.isHidden ? null : testCase.expectedOutput,
            actualOutput: testCase.isHidden ? null : result.stdout,
            runtimeMs: result.runtimeMs,
            memoryKB: result.memoryKB,
        });

        if (!passed) {
            return {
                verdict: 'wrong_answer',
                testResults,
                passedCount,
                totalCount: cases.length,
                runtimeMs: maxRuntime,
                memoryKB: maxMemory,
                stderr: null,
                compileOutput: null,
            };
        }
    }

    return {
        verdict: 'accepted',
        testResults,
        passedCount,
        totalCount: cases.length,
        runtimeMs: maxRuntime,
        memoryKB: maxMemory,
        stderr: null,
        compileOutput: null,
    };
}

/** Keep stored output bounded; the schema caps these at 10 KB. */
function truncate(text, max = 9000) {
    if (!text) return null;
    return text.length > max ? `${text.slice(0, max)}\n... truncated` : text;
}

/**
 * Run code against a single ad-hoc input, for the "Run" button.
 * No grading, no persistence — just execution and output.
 */
async function runOnce({ problem, language, sourceCode, stdin }) {
    const result = await execution.run({
        language,
        sourceCode,
        stdin: stdin ?? '',
        timeLimitSeconds: problem?.timeLimitSeconds || 5,
        memoryLimitKB: problem?.memoryLimitKB || 128_000,
    });

    return {
        status: result.status,
        stdout: result.stdout,
        stderr: truncate(result.stderr),
        compileOutput: truncate(result.compileOutput),
        runtimeMs: result.runtimeMs,
        memoryKB: result.memoryKB,
    };
}

module.exports = { grade, runOnce, outputMatches };
