import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import {
    Play, Send, RotateCcw, ChevronLeft, Check, X, Clock, AlertTriangle,
    Loader2, Trophy, Zap, BookOpen, History, FlaskConical, Terminal, Lock,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { problemsApi, verdictMeta, LANGUAGES, fallbackStarter } from '../services/problems';

/**
 * The Practice Arena.
 *
 * Layout follows the spec: statement on the left, editor and console on the
 * right, collapsing to tabs on mobile. The design leans on the mono/label
 * vocabulary so it reads as an instrument rather than a document.
 *
 * Draft code is persisted per (problem, language) in localStorage — losing
 * twenty minutes of work to an accidental refresh is the single worst thing
 * this page could do.
 */

const CM_LANG = { javascript, python, java, cpp, c: cpp };

const draftKey = (slug, lang) => `sv:draft:${slug}:${lang}`;

const DIFFICULTY_CLASS = {
    easy: 'badge badge-easy',
    medium: 'badge badge-medium',
    hard: 'badge badge-hard',
};

/** Verdict colouring, mapped from the shared tone vocabulary. */
const TONE = {
    pass: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', Icon: Check },
    fail: { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: X },
    warn: { text: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/30', Icon: AlertTriangle },
    idle: { text: 'text-muted-foreground', bg: 'bg-surface-2', border: 'border-border', Icon: Clock },
};

export default function ProblemSolve() {
    const { slug } = useParams();
    const { isAuthenticated } = useAuth();
    const { toast } = useToast();

    const [problem, setProblem] = useState(null);
    const [engine, setEngine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState('');
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);      // run output
    const [verdict, setVerdict] = useState(null);    // submit outcome
    const [customInput, setCustomInput] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [rightTab, setRightTab] = useState('console');
    const [mobileTab, setMobileTab] = useState('problem');
    const [history, setHistory] = useState([]);

    const loadedFor = useRef(null);

    // ── Load problem ────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await problemsApi.get(slug);
                if (cancelled) return;
                setProblem(data.problem);
                setEngine(data.engine);

                // Prefer a language the engine can actually run.
                const runnable = data.engine?.languages || [];
                const supported = data.problem.supported_languages || [];
                const usable = supported.filter((l) => runnable.includes(l));
                setLanguage(usable.includes('python') ? 'python' : (usable[0] || supported[0] || 'python'));
            } catch (err) {
                if (!cancelled) toast.error('Could not load problem', err?.response?.data?.message || '');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);

    // ── Restore draft, or fall back to the starter template ─────────
    useEffect(() => {
        if (!problem) return;
        const key = `${slug}:${language}`;
        if (loadedFor.current === key) return;
        loadedFor.current = key;

        let draft = null;
        try { draft = localStorage.getItem(draftKey(slug, language)); } catch { /* private mode */ }

        setCode(draft ?? problem.starter_code?.[language] ?? fallbackStarter(language));
    }, [problem, language, slug]);

    // ── Persist draft (debounced) ───────────────────────────────────
    useEffect(() => {
        if (!problem || !code) return undefined;
        const t = setTimeout(() => {
            try { localStorage.setItem(draftKey(slug, language), code); } catch { /* ignore */ }
        }, 600);
        return () => clearTimeout(t);
    }, [code, slug, language, problem]);

    const loadHistory = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await problemsApi.submissions(slug);
            setHistory(data.submissions || []);
        } catch { /* non-critical */ }
    }, [slug, isAuthenticated]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // ── Actions ─────────────────────────────────────────────────────
    const handleRun = async () => {
        setRunning(true);
        setVerdict(null);
        setRightTab('console');
        try {
            const data = await problemsApi.run(slug, {
                language,
                code,
                stdin: useCustom ? customInput : undefined,
            });
            setResult(data.result);
        } catch (err) {
            toast.error('Run failed', err?.response?.data?.message || 'Could not reach the judge.');
        } finally {
            setRunning(false);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setResult(null);
        setRightTab('verdict');
        try {
            const data = await problemsApi.submit(slug, { language, code });
            setVerdict(data);
            loadHistory();

            const g = data.gamification;
            if (data.submission.verdict === 'accepted') {
                if (g.xp_earned > 0) {
                    toast.success('Accepted!', `+${g.xp_earned} XP`);
                } else if (data.already_solved) {
                    toast.success('Accepted', 'Already solved — no additional XP.');
                }
                if (g.leveled_up) toast.success('Level up!', `You reached level ${g.level}`);
                g.badges?.forEach((b) => toast.success('Achievement unlocked', b.name));
                if (g.teaching_unlocked) toast.success('Teaching unlocked! 🎓', 'You can now create courses.');
                setProblem((p) => (p ? { ...p, solved: true } : p));
            }
        } catch (err) {
            toast.error('Submission failed', err?.response?.data?.message || 'Could not reach the judge.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetCode = () => {
        const starter = problem?.starter_code?.[language] ?? fallbackStarter(language);
        setCode(starter);
        try { localStorage.removeItem(draftKey(slug, language)); } catch { /* ignore */ }
    };

    if (loading) return <ArenaSkeleton />;

    if (!problem) {
        return (
            <div className="min-h-screen pt-24 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="font-display text-2xl mb-2">Problem not found</h1>
                    <Link to="/practice" className="btn-primary mt-4">Back to Practice</Link>
                </div>
            </div>
        );
    }

    const runnable = engine?.languages || [];
    const languageUnavailable = !runnable.includes(language);

    return (
        <div className="min-h-screen pt-16 bg-background">
            {/* ── Header bar ── */}
            <div className="border-b border-border bg-background-alt/60 sticky top-16 z-30 backdrop-blur-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
                    <Link
                        to="/practice"
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Back to practice"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>

                    <div className="flex items-center gap-2.5 min-w-0">
                        <h1 className="font-display text-base sm:text-lg font-bold truncate">{problem.title}</h1>
                        <span className={DIFFICULTY_CLASS[problem.difficulty]}>{problem.difficulty}</span>
                        {problem.solved && (
                            <span className="badge badge-primary gap-1">
                                <Check className="h-3 w-3" /> solved
                            </span>
                        )}
                    </div>

                    <div className="ml-auto hidden sm:flex items-center gap-4 label-mono">
                        {problem.acceptance_rate !== null && (
                            <span>{problem.acceptance_rate}% accepted</span>
                        )}
                        <span>{problem.solved_count} solved</span>
                    </div>
                </div>
            </div>

            {/* ── Mobile tab switcher ── */}
            <div className="lg:hidden border-b border-border bg-background sticky top-[7.25rem] z-20">
                <div className="flex">
                    {[
                        ['problem', 'Problem', BookOpen],
                        ['code', 'Code', Terminal],
                        ['output', 'Output', FlaskConical],
                    ].map(([id, label, Icon]) => (
                        <button
                            key={id}
                            onClick={() => setMobileTab(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobileTab === id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground'
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-0">

                {/* ══ LEFT: statement ══ */}
                <section
                    className={`${mobileTab === 'problem' ? 'block' : 'hidden'} lg:block lg:border-r border-border lg:h-[calc(100vh-8.5rem)] lg:overflow-y-auto`}
                >
                    <div className="p-5 sm:p-7 space-y-7">
                        <Statement problem={problem} />
                    </div>
                </section>

                {/* ══ RIGHT: editor + console ══ */}
                <section className="lg:h-[calc(100vh-8.5rem)] flex flex-col">

                    {/* Toolbar */}
                    <div className={`${mobileTab === 'code' ? 'flex' : 'hidden'} lg:flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background-alt/40`}>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono focus-ring"
                            aria-label="Language"
                        >
                            {(problem.supported_languages || []).map((l) => (
                                <option key={l} value={l}>
                                    {LANGUAGES[l]?.label || l}
                                    {!runnable.includes(l) ? ' — unavailable' : ''}
                                </option>
                            ))}
                        </select>

                        <span className="label-mono hidden sm:inline">{LANGUAGES[language]?.file}</span>

                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={resetCode} className="btn-ghost !px-2" title="Reset to starter code">
                                <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                                onClick={handleRun}
                                disabled={running || submitting || languageUnavailable}
                                className="btn-secondary !py-1.5"
                            >
                                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Run
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={running || submitting || languageUnavailable || !isAuthenticated}
                                className="btn-primary !py-1.5"
                                title={!isAuthenticated ? 'Sign in to submit' : undefined}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Submit
                            </button>
                        </div>
                    </div>

                    {languageUnavailable && (
                        <div className="px-4 py-2 bg-amber/10 border-b border-amber/25 text-xs text-amber flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {LANGUAGES[language]?.label} needs a compiler this server does not have.
                            Configure Judge0 to run it.
                        </div>
                    )}

                    {/* Editor */}
                    <div className={`${mobileTab === 'code' ? 'block' : 'hidden'} lg:block flex-1 min-h-[320px] overflow-hidden border-b border-border`}>
                        <CodeMirror
                            value={code}
                            height="100%"
                            className="h-full text-sm"
                            extensions={[(CM_LANG[language] || python)()]}
                            onChange={setCode}
                            basicSetup={{
                                lineNumbers: true,
                                highlightActiveLine: true,
                                bracketMatching: true,
                                autocompletion: true,
                                closeBrackets: true,
                                tabSize: 4,
                            }}
                        />
                    </div>

                    {/* Console */}
                    <div className={`${mobileTab === 'output' ? 'block' : 'hidden'} lg:block lg:h-[38%] flex flex-col min-h-[220px]`}>
                        <div className="flex items-center gap-1 px-3 border-b border-border bg-background-alt/40">
                            {[
                                ['console', 'Console'],
                                ['verdict', 'Verdict'],
                                ['history', `History${history.length ? ` (${history.length})` : ''}`],
                            ].map(([id, label]) => (
                                <button
                                    key={id}
                                    onClick={() => setRightTab(id)}
                                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${rightTab === id
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                            {engine && !engine.isSandboxed && (
                                <span
                                    className="ml-auto badge badge-amber gap-1"
                                    title="Code is running directly on this machine, not in an isolated sandbox. Development only."
                                >
                                    <Lock className="h-3 w-3" /> local engine
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px]">
                            {rightTab === 'console' && (
                                <ConsolePanel
                                    result={result}
                                    running={running}
                                    useCustom={useCustom}
                                    setUseCustom={setUseCustom}
                                    customInput={customInput}
                                    setCustomInput={setCustomInput}
                                />
                            )}
                            {rightTab === 'verdict' && <VerdictPanel verdict={verdict} submitting={submitting} />}
                            {rightTab === 'history' && <HistoryPanel history={history} />}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */

function Statement({ problem }) {
    return (
        <>
            <div>
                <p className="label-mono mb-3">Problem</p>
                <div className="prose-sv whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/90">
                    {problem.description}
                </div>
            </div>

            {problem.input_format && (
                <Section title="Input">{problem.input_format}</Section>
            )}
            {problem.output_format && (
                <Section title="Output">{problem.output_format}</Section>
            )}
            {problem.constraints && (
                <Section title="Constraints">
                    <code className="text-primary">{problem.constraints}</code>
                </Section>
            )}

            {problem.examples?.length > 0 && (
                <div>
                    <p className="label-mono mb-3">Examples</p>
                    <div className="space-y-3">
                        {problem.examples.map((ex, i) => (
                            <div key={i} className="card-base rounded-xl overflow-hidden">
                                <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                                    <IOBlock label="Input" value={ex.input} />
                                    <IOBlock label="Output" value={ex.output} />
                                </div>
                                {ex.explanation && (
                                    <div className="px-3.5 py-2.5 border-t border-border bg-surface-1 text-xs text-muted-foreground">
                                        {ex.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {problem.tags?.length > 0 && (
                <div>
                    <p className="label-mono mb-2.5">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                        {problem.tags.map((t) => (
                            <span key={t.id} className="badge badge-neutral">{t.name || t.id}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Editorials are a spoiler; the server only sends one once solved. */}
            {problem.editorial ? (
                <Section title="Editorial">
                    <div className="whitespace-pre-wrap">{problem.editorial}</div>
                </Section>
            ) : (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-border bg-surface-1 text-xs text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0" />
                    The editorial unlocks once you solve this problem.
                </div>
            )}
        </>
    );
}

const Section = ({ title, children }) => (
    <div>
        <p className="label-mono mb-2">{title}</p>
        <div className="text-[0.9rem] leading-relaxed text-foreground/85 whitespace-pre-wrap">{children}</div>
    </div>
);

const IOBlock = ({ label, value }) => (
    <div className="p-3.5">
        <p className="label-mono mb-1.5">{label}</p>
        <pre className="font-mono text-xs whitespace-pre-wrap break-words text-foreground">{value}</pre>
    </div>
);

/* ═══════════════════════════════════════════════════════════ */

function ConsolePanel({ result, running, useCustom, setUseCustom, customInput, setCustomInput }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={useCustom}
                        onChange={(e) => setUseCustom(e.target.checked)}
                        className="accent-primary"
                    />
                    <span className="label-mono !text-[0.7rem]">Custom input</span>
                </label>
            </div>

            {useCustom && (
                <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="stdin for your program"
                    rows={4}
                    className="input-styled font-mono !text-xs"
                />
            )}

            {running && (
                <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> running…
                </p>
            )}

            {!running && !result && (
                <p className="text-muted-foreground">
                    Press <span className="text-foreground">Run</span> to execute against the sample input,
                    or <span className="text-foreground">Submit</span> to grade against every test.
                </p>
            )}

            {!running && result && (
                <div className="space-y-3 animate-rise">
                    {result.input_used !== undefined && result.input_used !== '' && (
                        <Field label="stdin" value={result.input_used} />
                    )}
                    {result.compile_output && (
                        <Field label="compiler" value={result.compile_output} tone="warn" />
                    )}
                    {result.stderr && <Field label="stderr" value={result.stderr} tone="fail" />}
                    <Field label="stdout" value={result.stdout || '(no output)'} />
                    {result.expected_output !== undefined && (
                        <Field label="expected" value={result.expected_output} tone="pass" />
                    )}
                    <p className="label-mono">
                        {result.status} · {result.runtime_ms}ms
                        {result.memory_kb ? ` · ${Math.round(result.memory_kb / 1024)}MB` : ''}
                    </p>
                </div>
            )}
        </div>
    );
}

const Field = ({ label, value, tone }) => {
    const color = tone === 'fail' ? 'text-destructive'
        : tone === 'warn' ? 'text-amber'
            : tone === 'pass' ? 'text-primary' : 'text-foreground';
    return (
        <div>
            <p className="label-mono mb-1">{label}</p>
            <pre className={`whitespace-pre-wrap break-words rounded-lg bg-surface-1 border border-border p-2.5 text-xs ${color}`}>
                {value}
            </pre>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════ */

function VerdictPanel({ verdict, submitting }) {
    if (submitting) {
        return (
            <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> grading against all tests…
            </p>
        );
    }
    if (!verdict) {
        return <p className="text-muted-foreground">Submit to see your verdict.</p>;
    }

    const s = verdict.submission;
    const meta = verdictMeta(s.verdict);
    const tone = TONE[meta.tone];
    const { Icon } = tone;
    const g = verdict.gamification;

    return (
        <div className="space-y-4 animate-verdict">
            <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${tone.bg} ${tone.border}`}>
                <Icon className={`h-5 w-5 shrink-0 ${tone.text}`} />
                <div className="min-w-0">
                    <p className={`font-display font-bold ${tone.text}`}>{meta.label}</p>
                    <p className="label-mono !text-[0.7rem] mt-0.5">
                        {s.passed_count}/{s.total_count} tests
                        {s.runtime_ms != null ? ` · ${s.runtime_ms}ms` : ''}
                    </p>
                </div>
                {g?.xp_earned > 0 && (
                    <span className="ml-auto badge badge-amber gap-1">
                        <Zap className="h-3 w-3" /> +{g.xp_earned} XP
                    </span>
                )}
            </div>

            {verdict.already_solved && (
                <p className="text-xs text-muted-foreground">
                    You had already solved this, so no additional XP was awarded.
                </p>
            )}

            {s.compile_output && <Field label="compiler" value={s.compile_output} tone="warn" />}
            {s.stderr && <Field label="stderr" value={s.stderr} tone="fail" />}

            {s.test_results?.length > 0 && (
                <div>
                    <p className="label-mono mb-2">Tests</p>
                    <div className="space-y-1.5">
                        {s.test_results.map((t) => (
                            <div
                                key={t.order}
                                className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-surface-1 border border-border"
                            >
                                {t.passed
                                    ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                    : <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                <span className="label-mono !text-[0.7rem]">test {t.order}</span>
                                {t.isHidden && <span className="badge badge-neutral !py-0">hidden</span>}
                                {t.runtimeMs != null && (
                                    <span className="ml-auto label-mono !text-[0.7rem]">{t.runtimeMs}ms</span>
                                )}
                            </div>
                        ))}
                    </div>
                    {/* Only failures on VISIBLE tests show their data. */}
                    {s.test_results.some((t) => !t.passed && !t.isHidden) && (
                        <div className="mt-3 space-y-3">
                            {s.test_results.filter((t) => !t.passed && !t.isHidden).map((t) => (
                                <div key={`d-${t.order}`} className="space-y-2">
                                    <Field label={`test ${t.order} · input`} value={t.input} />
                                    <Field label="expected" value={t.expectedOutput} tone="pass" />
                                    <Field label="got" value={t.actualOutput || '(no output)'} tone="fail" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {g?.badges?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {g.badges.map((b) => (
                        <span key={b.id} className="badge badge-amber gap-1">
                            <Trophy className="h-3 w-3" /> {b.name}
                        </span>
                    ))}
                </div>
            )}

            {g?.teaching_unlocked && (
                <div className="p-3.5 rounded-xl bg-violet/10 border border-violet/30">
                    <p className="font-display font-bold text-violet mb-1">🎓 Teaching unlocked</p>
                    <p className="text-xs text-muted-foreground">
                        You have met every requirement. You can now create courses and problems.
                    </p>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */

function HistoryPanel({ history }) {
    if (!history.length) {
        return <p className="text-muted-foreground">No submissions yet.</p>;
    }
    return (
        <div className="space-y-1.5">
            {history.map((s) => {
                const meta = verdictMeta(s.verdict);
                const tone = TONE[meta.tone];
                return (
                    <div
                        key={s.id}
                        className="flex items-center gap-2.5 text-xs px-3 py-2 rounded-lg bg-surface-1 border border-border"
                    >
                        <tone.Icon className={`h-3.5 w-3.5 shrink-0 ${tone.text}`} />
                        <span className={`font-semibold ${tone.text}`}>{meta.label}</span>
                        <span className="label-mono !text-[0.7rem]">{s.language}</span>
                        <span className="label-mono !text-[0.7rem]">{s.passed_count}/{s.total_count}</span>
                        <span className="ml-auto label-mono !text-[0.7rem]">
                            {new Date(s.created_at).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */

const ArenaSkeleton = () => (
    <div className="min-h-screen pt-24 max-w-[1600px] mx-auto px-6 grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
            <div className="skeleton h-7 w-2/3" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-28 w-full" />
        </div>
        <div className="skeleton h-96 w-full" />
    </div>
);
