import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Flame, Zap, Target, BookOpen, Trophy, GraduationCap, ChevronRight,
    Terminal, Lock, Check, TrendingUp, Award,
} from 'lucide-react';

import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * The learner dashboard (spec §12) — the app's missing front door.
 *
 * The organising idea is the teaching ladder: everything here is framed as
 * "where you are, and what is left". The unlock panel is the emotional centre
 * of the product, so it gets the most visual weight and the violet accent
 * reserved for teaching.
 */

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [streak, setStreak] = useState(null);
    const [teaching, setTeaching] = useState(null);
    const [courses, setCourses] = useState([]);
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            // Every panel is independent; one failing endpoint must not blank
            // the whole dashboard.
            const [s, st, t, e, b] = await Promise.allSettled([
                api.get('/gamification/stats'),
                api.get('/gamification/streak'),
                api.get('/gamification/teaching'),
                api.get('/enrollments'),
                api.get('/gamification/badges'),
            ]);
            if (s.status === 'fulfilled') setStats(s.value.data);
            if (st.status === 'fulfilled') setStreak(st.value.data);
            if (t.status === 'fulfilled') setTeaching(t.value.data.teaching);
            if (e.status === 'fulfilled') setCourses(e.value.data.courses || []);
            if (b.status === 'fulfilled') setBadges(b.value.data.badges || []);
            setLoading(false);
        })();
    }, []);

    if (loading) return <DashboardSkeleton />;

    const xp = stats?.xpProgress;
    const inProgress = courses.filter((c) => c.progress_percentage < 100).slice(0, 3);

    return (
        <div className="min-h-screen pt-16 bg-background">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-7">

                {/* ── Greeting + level ── */}
                <motion.header
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-end justify-between gap-5"
                >
                    <div>
                        <p className="label-mono mb-2">Dashboard</p>
                        <h1 className="font-display text-2xl sm:text-3xl font-bold">
                            Welcome back, {user?.full_name?.split(' ')[0] || 'learner'}.
                        </h1>
                    </div>

                    {xp && (
                        <div className="sm:text-right sm:min-w-[260px]">
                            <div className="flex items-baseline gap-2 sm:justify-end mb-1.5">
                                <span className="numeral text-3xl font-bold text-amber">{xp.level}</span>
                                <span className="label-mono">{xp.title}</span>
                            </div>
                            <div className="progress-track h-2 w-full sm:w-[260px]">
                                <div
                                    className="progress-bar-xp h-full"
                                    style={{ width: `${xp.progressPercentage}%` }}
                                />
                            </div>
                            <p className="label-mono !text-[0.68rem] mt-1.5">
                                {xp.xpInCurrentLevel.toLocaleString()} / {xp.xpNeededForNext.toLocaleString()} XP to level {xp.level + 1}
                            </p>
                        </div>
                    )}
                </motion.header>

                {/* ── Key metrics ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat
                        icon={Flame} tone="amber" label="Day streak"
                        value={streak?.currentStreak ?? 0}
                        sub={streak?.isAtRisk ? 'at risk today' : `best ${streak?.longestStreak ?? 0}`}
                        alert={streak?.isAtRisk}
                    />
                    <Stat icon={Target} tone="primary" label="Problems solved" value={stats?.stats?.problems_solved ?? 0} />
                    <Stat icon={BookOpen} tone="foreground" label="Courses done" value={stats?.stats?.courses_completed ?? 0} />
                    <Stat icon={Trophy} tone="amber" label="Achievements" value={badges.length} />
                </div>

                {/* ── Teaching ladder — the centrepiece ── */}
                {teaching && <TeachingPanel teaching={teaching} />}

                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">

                    {/* Continue learning */}
                    <section className="card-base rounded-2xl p-5 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="label-mono">Continue learning</p>
                            <Link to="/my-courses" className="label-mono hover:text-foreground transition-colors">
                                all courses →
                            </Link>
                        </div>

                        {inProgress.length === 0 ? (
                            <Empty
                                icon={BookOpen}
                                title="Nothing in progress"
                                action={<Link to="/courses" className="btn-primary mt-4">Browse courses</Link>}
                            />
                        ) : (
                            <div className="space-y-2.5">
                                {inProgress.map((c) => (
                                    <Link
                                        key={c.course_id}
                                        to={`/courses/${c.course_id}/learn`}
                                        className="block p-3.5 rounded-xl border border-border hover:border-border-strong bg-surface-1 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 mb-2.5">
                                            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                                {c.title}
                                            </p>
                                            <span className="ml-auto numeral text-xs text-muted-foreground shrink-0">
                                                {c.completed_lessons}/{c.total_lessons}
                                            </span>
                                        </div>
                                        <div className="progress-track h-1.5">
                                            <div
                                                className="progress-bar h-full"
                                                style={{ width: `${c.progress_percentage}%` }}
                                            />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Practice CTA + streak week */}
                    <div className="space-y-5">
                        <section className="card-base rounded-2xl p-5 sm:p-6">
                            <p className="label-mono mb-3">Practice</p>
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                Solving problems is the fastest route to the teaching threshold.
                            </p>
                            <Link to="/practice" className="btn-primary w-full">
                                <Terminal className="h-4 w-4" /> Open the Arena
                            </Link>
                        </section>

                        {streak?.recentActivity && (
                            <section className="card-base rounded-2xl p-5 sm:p-6">
                                <p className="label-mono mb-3.5">Last 7 days</p>
                                <div className="flex gap-1.5">
                                    {streak.recentActivity.map((d) => {
                                        const active = d.xp_earned > 0 || d.lessons_completed > 0;
                                        return (
                                            <div key={d.activity_date} className="flex-1 text-center">
                                                <div
                                                    className={`h-9 rounded-lg border transition-colors ${active
                                                        ? 'bg-primary/20 border-primary/40'
                                                        : 'bg-surface-1 border-border'
                                                        }`}
                                                    title={`${d.activity_date}: ${d.xp_earned} XP`}
                                                />
                                                <p className="label-mono !text-[0.6rem] mt-1.5">
                                                    {new Date(`${d.activity_date}T00:00:00Z`)
                                                        .toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' })}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* ── Achievements ── */}
                {badges.length > 0 && (
                    <section className="card-base rounded-2xl p-5 sm:p-6">
                        <p className="label-mono mb-4">Recent achievements</p>
                        <div className="flex flex-wrap gap-2">
                            {badges.slice(0, 10).map((b) => (
                                <span key={b.id} className="badge badge-amber gap-1.5 !py-1.5 !px-2.5">
                                    <Award className="h-3.5 w-3.5" />
                                    {b.name}
                                </span>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */

/**
 * The teaching ladder.
 *
 * Shows every requirement with current-versus-target, because "locked" without
 * a reason is the least motivating thing a progression system can say.
 */
function TeachingPanel({ teaching }) {
    const unlocked = teaching.isUnlocked;
    const met = teaching.requirements.filter((r) => r.met).length;
    const total = teaching.requirements.length;

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className={`card-base rounded-2xl p-5 sm:p-6 ${unlocked ? 'border-violet/35 bg-violet/[0.04]' : ''}`}
        >
            <div className="flex items-start gap-4 mb-5">
                <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${unlocked ? 'bg-violet/15 text-violet' : 'bg-surface-2 text-muted-foreground'
                    }`}>
                    {unlocked ? <GraduationCap className="h-5 w-5" /> : <Lock className="h-4.5 w-4.5" />}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-display text-lg font-bold">
                            {unlocked ? 'Teaching unlocked' : 'Teaching'}
                        </h2>
                        <span className={`badge ${unlocked ? 'badge-violet' : 'badge-neutral'}`}>
                            {unlocked ? 'unlocked' : `${met}/${total} met`}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {unlocked
                            ? 'You have demonstrated enough learning to teach others. Create courses, problems and quizzes.'
                            : 'Keep learning to unlock the ability to teach on SkillVerse.'}
                    </p>
                </div>

                {unlocked && (
                    <Link to="/instructor/dashboard" className="btn-primary shrink-0 hidden sm:inline-flex">
                        Start teaching <ChevronRight className="h-4 w-4" />
                    </Link>
                )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {teaching.requirements.map((r) => (
                    <Requirement key={r.key} req={r} />
                ))}
            </div>

            {unlocked && (
                <Link to="/instructor/dashboard" className="btn-primary w-full mt-5 sm:hidden">
                    Start teaching
                </Link>
            )}
        </motion.section>
    );
}

function Requirement({ req }) {
    const pct = req.required > 0
        ? Math.min(100, Math.round((req.current / req.required) * 100))
        : 100;

    return (
        <div className={`p-3 rounded-xl border ${req.met ? 'border-violet/30 bg-violet/[0.06]' : 'border-border bg-surface-1'
            }`}>
            <div className="flex items-center gap-2 mb-2">
                {req.met
                    ? <Check className="h-3.5 w-3.5 text-violet shrink-0" />
                    : <span className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />}
                <span className="label-mono !text-[0.66rem] truncate">{req.label}</span>
                <span className={`ml-auto numeral text-xs shrink-0 ${req.met ? 'text-violet' : 'text-muted-foreground'}`}>
                    {req.current}{req.unit || ''} / {req.required}{req.unit || ''}
                </span>
            </div>
            <div className="progress-track h-1">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${req.met ? 'bg-violet' : 'bg-muted-foreground/40'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */

const STAT_TONE = {
    amber: 'text-amber',
    primary: 'text-primary',
    foreground: 'text-foreground',
};

const Stat = ({ icon: Icon, label, value, sub, tone = 'foreground', alert }) => (
    <div className={`stat-card ${alert ? 'border-amber/40' : ''}`}>
        <div className="flex items-center gap-2 mb-2.5">
            <Icon className={`h-4 w-4 ${STAT_TONE[tone]}`} />
            <span className="label-mono !text-[0.66rem]">{label}</span>
        </div>
        <p className="numeral text-2xl font-bold leading-none">{value}</p>
        {sub && (
            <p className={`label-mono !text-[0.64rem] mt-1.5 ${alert ? '!text-amber' : ''}`}>{sub}</p>
        )}
    </div>
);

const Empty = ({ icon: Icon, title, action }) => (
    <div className="py-10 text-center">
        <Icon className="h-7 w-7 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{title}</p>
        {action}
    </div>
);

const DashboardSkeleton = () => (
    <div className="min-h-screen pt-24 max-w-6xl mx-auto px-6 space-y-6">
        <div className="skeleton h-9 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-52 w-full" />
        <div className="grid lg:grid-cols-2 gap-5">
            <div className="skeleton h-56" />
            <div className="skeleton h-56" />
        </div>
    </div>
);
