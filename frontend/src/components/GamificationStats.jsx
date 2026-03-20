import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  Zap, Flame, Trophy, Star, TrendingUp,
  Target, Award, ChevronRight, BookOpen
} from 'lucide-react';

// Tier colors and labels
const TIER_STYLES = {
  bronze:   { bg: 'bg-amber-50',   border: 'border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100',  dot: 'bg-amber-500'  },
  silver:   { bg: 'bg-slate-50',   border: 'border-slate-300', text: 'text-slate-600',  badge: 'bg-slate-100',  dot: 'bg-slate-400'  },
  gold:     { bg: 'bg-yellow-50',  border: 'border-yellow-300',text: 'text-yellow-700', badge: 'bg-yellow-100', dot: 'bg-yellow-500' },
  platinum: { bg: 'bg-cyan-50',    border: 'border-cyan-200',  text: 'text-cyan-700',   badge: 'bg-cyan-100',   dot: 'bg-cyan-500'   },
  diamond:  { bg: 'bg-violet-50',  border: 'border-violet-200',text: 'text-violet-700', badge: 'bg-violet-100', dot: 'bg-violet-500' },
};

function LevelRing({ level, progressPct }) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (progressPct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke="url(#xpGrad)" strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <defs>
          <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <div className="z-10 text-center">
        <div className="text-2xl font-black text-foreground leading-none">{level}</div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Level</div>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[color]} text-sm font-medium`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-bold ml-auto">{value}</span>
    </div>
  );
}

export default function GamificationStats({ lessonsCompleted = 0, totalLessons = 0 }) {
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, streakRes, badgesRes] = await Promise.allSettled([
          api.get('/gamification/stats'),
          api.get('/gamification/streak'),
          api.get('/gamification/badges'),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (streakRes.status === 'fulfilled') setStreak(streakRes.value.data);
        if (badgesRes.status === 'fulfilled') setBadges(badgesRes.value.data?.badges || []);
      } catch (e) {
        // silently fail — stats are non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-4" />
        <div className="h-24 bg-muted rounded-xl mb-4" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  const xp = stats?.xp ?? 0;
  const level = stats?.level ?? 1;
  const progressPct = stats?.xpProgress?.progressPercentage ?? 0;
  const xpInLevel = stats?.xpProgress?.xpInCurrentLevel ?? 0;
  const xpNeeded = stats?.xpProgress?.xpNeededForNext ?? 100;
  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const hasActivityToday = streak?.hasActivityToday ?? false;

  // lesson progress ring
  const lessonPct = totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60 bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground text-base">Your Progress</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Stats & Achievements</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
            <Zap className="h-3 w-3 fill-blue-400" />
            {xp.toLocaleString()} XP
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Level Ring + XP progress */}
        <div className="flex items-center gap-5">
          <LevelRing level={level} progressPct={progressPct} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-foreground">Level {level} → {level + 1}</span>
              <span className="text-muted-foreground">{xpInLevel} / {xpNeeded} XP</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{xpNeeded - xpInLevel} XP to next level</p>
          </div>
        </div>

        {/* Lesson Completion Ring (LeetCode style) */}
        {totalLessons > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-background">
            {/* Mini donut */}
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="#10b981" strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - lessonPct / 100)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-emerald-600">{lessonPct}%</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground mb-1">Lessons Completed</div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-600 font-bold">{lessonsCompleted}</span>
                <span className="text-muted-foreground">/ {totalLessons} total</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${lessonPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatPill icon={Flame}    label="Current Streak" value={`${currentStreak}d`} color="orange" />
          <StatPill icon={TrendingUp} label="Best Streak"  value={`${longestStreak}d`} color="purple" />
          <StatPill icon={Target}   label="Today's Status" value={hasActivityToday ? '✅ Done' : '⏳ Pending'} color={hasActivityToday ? 'green' : 'blue'} />
          <StatPill icon={Trophy}   label="Badges"         value={badges.length}       color="purple" />
        </div>

        {/* Streak heatmap dots — last 7 days */}
        {streak?.recentActivity?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Last 7 Days</div>
            <div className="flex gap-1.5">
              {(() => {
                const days = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().split('T')[0];
                  const activity = streak.recentActivity.find(a => a.activity_date?.split('T')[0] === dateStr || a.activity_date === dateStr);
                  days.push({ dateStr, activity });
                }
                return days.map(({ dateStr, activity }) => (
                  <div
                    key={dateStr}
                    title={`${dateStr}: ${activity ? `${activity.lessons_completed} lessons, ${activity.xp_earned} XP` : 'No activity'}`}
                    className={`flex-1 h-7 rounded-md border transition-all cursor-default ${
                      activity
                        ? 'bg-emerald-400 border-emerald-500 shadow-sm shadow-emerald-200'
                        : 'bg-muted border-border'
                    }`}
                  />
                ));
              })()}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
              <span>6d ago</span>
              <span>Today</span>
            </div>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badges Earned</div>
              <Award className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badges.slice(0, 8).map((badge, i) => {
                const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
                return (
                  <div
                    key={i}
                    title={`${badge.name}${badge.xp_reward ? ` (+${badge.xp_reward} XP)` : ''}`}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium ${tier.bg} ${tier.border} ${tier.text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                    {badge.name}
                  </div>
                );
              })}
              {badges.length > 8 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-muted text-[11px] text-muted-foreground font-medium">
                  +{badges.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
