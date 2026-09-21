import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, Check, Filter, Loader2, Terminal, Target, Flame, ChevronRight,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { problemsApi } from '../services/problems';

/**
 * Practice Arena index.
 *
 * Reads as a problem set, not a marketing grid: a dense table on desktop,
 * stacked rows on mobile, with the learner's own progress pinned at the top so
 * the teaching threshold is always visible from here.
 */

const DIFFICULTIES = ['easy', 'medium', 'hard'];

export default function Practice() {
    const { isAuthenticated, user } = useAuth();
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [engine, setEngine] = useState(null);

    const load = useCallback(async (params) => {
        setLoading(true);
        try {
            const data = await problemsApi.list(params);
            setProblems(data.problems || []);
        } catch {
            setProblems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced search — one request per pause, not per keystroke.
    useEffect(() => {
        const t = setTimeout(() => {
            load({ ...(search ? { search } : {}), ...(difficulty ? { difficulty } : {}) });
        }, 280);
        return () => clearTimeout(t);
    }, [search, difficulty, load]);

    useEffect(() => {
        problemsApi.engine().then((d) => setEngine(d.engine)).catch(() => { });
    }, []);

    const solvedCount = problems.filter((p) => p.solved).length;
    const stats = user?.learningStats || {};

    return (
        <div className="min-h-screen pt-16 bg-background">

            {/* ── Header ── */}
            <div className="relative border-b border-border overflow-hidden">
                <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                    <p className="label-mono mb-3 flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5" /> Practice Arena
                    </p>
                    <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
                        Write code. <span className="text-gradient">Run it. Prove it.</span>
                    </h1>
                    <p className="text-muted-foreground max-w-xl text-[0.95rem] leading-relaxed">
                        Every solved problem counts toward unlocking the ability to teach.
                        Your code is compiled and run against real test cases.
                    </p>

                    {isAuthenticated && (
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Metric label="Solved" value={stats.problemsSolved ?? 0} icon={Target} tone="primary" />
                            <Metric label="Level" value={user?.level ?? 1} icon={Flame} tone="amber" />
                            <Metric label="XP" value={(user?.xp ?? 0).toLocaleString()} icon={Flame} tone="amber" />
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

                {/* ── Filters ── */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search problems…"
                            className="input-styled !pl-9"
                            aria-label="Search problems"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setDifficulty('')}
                            className={`badge ${!difficulty ? 'badge-primary' : 'badge-neutral'} !px-3 !py-1.5`}
                        >
                            All
                        </button>
                        {DIFFICULTIES.map((d) => (
                            <button
                                key={d}
                                onClick={() => setDifficulty(difficulty === d ? '' : d)}
                                className={`badge !px-3 !py-1.5 ${difficulty === d ? `badge-${d}` : 'badge-neutral'}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Column header ── */}
                <div className="hidden sm:grid grid-cols-[2rem_1fr_7rem_6rem_5rem] gap-3 px-4 pb-2 label-mono">
                    <span />
                    <span>Problem</span>
                    <span>Difficulty</span>
                    <span className="text-right">Solved by</span>
                    <span className="text-right">Rate</span>
                </div>

                {/* ── List ── */}
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="skeleton h-14 w-full" />
                        ))}
                    </div>
                ) : problems.length === 0 ? (
                    <EmptyState search={search} />
                ) : (
                    <div className="space-y-2">
                        {problems.map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.2) }}
                            >
                                <Link
                                    to={`/practice/${p.slug}`}
                                    className="card-base card-interactive rounded-xl grid sm:grid-cols-[2rem_1fr_7rem_6rem_5rem] gap-3 items-center px-4 py-3.5 group"
                                >
                                    <span className="hidden sm:flex justify-center">
                                        {p.solved
                                            ? <Check className="h-4 w-4 text-primary" aria-label="Solved" />
                                            : <span className="h-4 w-4 rounded-full border border-border" />}
                                    </span>

                                    <div className="min-w-0">
                                        <p className="font-semibold text-[0.95rem] truncate group-hover:text-primary transition-colors">
                                            {p.title}
                                        </p>
                                        {p.tags?.length > 0 && (
                                            <p className="label-mono !text-[0.68rem] mt-0.5 truncate">
                                                {p.tags.map((t) => t.name).filter(Boolean).join(' · ')}
                                            </p>
                                        )}
                                    </div>

                                    <span className="sm:justify-self-start">
                                        <span className={`badge badge-${p.difficulty}`}>{p.difficulty}</span>
                                        {p.solved && (
                                            <span className="sm:hidden ml-2 badge badge-primary gap-1">
                                                <Check className="h-3 w-3" /> solved
                                            </span>
                                        )}
                                    </span>

                                    <span className="hidden sm:block text-right numeral text-sm text-muted-foreground">
                                        {p.solved_count}
                                    </span>
                                    <span className="hidden sm:flex items-center justify-end gap-1 numeral text-sm text-muted-foreground">
                                        {p.acceptance_rate !== null ? `${p.acceptance_rate}%` : '—'}
                                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </span>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Honest about what the judge can run right now. */}
                {engine && (
                    <p className="mt-8 label-mono text-center">
                        judge: {engine.engine}
                        {engine.languages?.length ? ` · ${engine.languages.join(' · ')}` : ''}
                        {!engine.isSandboxed && ' · development mode'}
                    </p>
                )}
            </div>
        </div>
    );
}

const TONE_CLASS = {
    primary: 'text-primary',
    amber: 'text-amber',
};

const Metric = ({ label, value, icon: Icon, tone }) => (
    <div className="stat-card !py-2.5 !px-3.5 flex items-center gap-2.5">
        <Icon className={`h-4 w-4 ${TONE_CLASS[tone]}`} />
        <div>
            <p className="numeral text-lg font-bold leading-none">{value}</p>
            <p className="label-mono !text-[0.65rem] mt-1">{label}</p>
        </div>
    </div>
);

const EmptyState = ({ search }) => (
    <div className="card-base rounded-2xl p-12 text-center">
        <Filter className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="font-display font-bold mb-1">No problems found</p>
        <p className="text-sm text-muted-foreground">
            {search ? `Nothing matches "${search}".` : 'No problems are published yet.'}
        </p>
    </div>
);
