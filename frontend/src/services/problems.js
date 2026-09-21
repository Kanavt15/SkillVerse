/**
 * Practice Arena API.
 *
 * The start of the service layer the app has been missing — every page
 * previously called `api.get('/...')` inline, which made endpoints impossible
 * to find and response shapes impossible to change safely.
 */

import api from '../lib/api';

export const problemsApi = {
    /** @param {{difficulty?, category?, tags?, search?, sort?, page?, limit?}} params */
    list: (params = {}) => api.get('/problems', { params }).then((r) => r.data),

    get: (slug) => api.get(`/problems/${slug}`).then((r) => r.data),

    /** Execute without grading. Omit `stdin` to use the problem's first sample. */
    run: (slug, { language, code, stdin }) =>
        api.post(`/problems/${slug}/run`, { language, code, stdin }).then((r) => r.data),

    /** Grade against every test case. */
    submit: (slug, { language, code }) =>
        api.post(`/problems/${slug}/submit`, { language, code }).then((r) => r.data),

    submissions: (slug) => api.get(`/problems/${slug}/submissions`).then((r) => r.data),

    mySubmissions: (params = {}) =>
        api.get('/problems/me/submissions', { params }).then((r) => r.data),

    engine: () => api.get('/problems/meta/engine').then((r) => r.data),
};

/** Verdict presentation, in one place so every surface agrees. */
export const VERDICTS = {
    accepted: { label: 'Accepted', tone: 'pass', icon: 'check' },
    wrong_answer: { label: 'Wrong Answer', tone: 'fail', icon: 'x' },
    compilation_error: { label: 'Compilation Error', tone: 'warn', icon: 'alert' },
    runtime_error: { label: 'Runtime Error', tone: 'fail', icon: 'alert' },
    time_limit_exceeded: { label: 'Time Limit Exceeded', tone: 'warn', icon: 'clock' },
    memory_limit_exceeded: { label: 'Memory Limit Exceeded', tone: 'warn', icon: 'alert' },
    internal_error: { label: 'Judge Error', tone: 'warn', icon: 'alert' },
    pending: { label: 'Pending', tone: 'idle', icon: 'clock' },
    running: { label: 'Running', tone: 'idle', icon: 'clock' },
};

export const verdictMeta = (v) => VERDICTS[v] || VERDICTS.internal_error;

/** Editor + display metadata per language. */
export const LANGUAGES = {
    javascript: { label: 'JavaScript', file: 'solution.js', comment: '//' },
    python: { label: 'Python', file: 'solution.py', comment: '#' },
    java: { label: 'Java', file: 'Main.java', comment: '//' },
    cpp: { label: 'C++', file: 'solution.cpp', comment: '//' },
    c: { label: 'C', file: 'solution.c', comment: '//' },
};

/**
 * A usable starting point when a problem ships no template for the chosen
 * language — an empty editor with no hint about how to read input is a wall.
 */
export const fallbackStarter = (language) => {
    switch (language) {
        case 'python':
            return 'import sys\n\ndata = sys.stdin.read().split()\n# your solution here\n';
        case 'javascript':
            return 'const data = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/);\n// your solution here\n';
        case 'java':
            return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // your solution here\n    }\n}\n';
        case 'cpp':
            return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your solution here\n    return 0;\n}\n';
        case 'c':
            return '#include <stdio.h>\n\nint main(void) {\n    /* your solution here */\n    return 0;\n}\n';
        default:
            return '';
    }
};
