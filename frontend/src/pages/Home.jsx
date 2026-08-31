import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  BookOpen, Users, Star, Trophy, ArrowRight, Sparkles,
  GraduationCap, Target, Zap, Globe, CheckCircle2, TrendingUp,
  PlayCircle, Code, ShieldCheck, Flame, BarChart3, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ─── Reusable animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

function InViewSection({ children, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <Code className="h-5 w-5" />,
      title: 'Industry-Ready Skills',
      description: 'Master in-demand technologies through practical, hands-on project-based courses.',
      iconClass: 'bg-violet-500/10 text-violet-600 border-violet-200',
      darkIconClass: 'dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/20',
    },
    {
      icon: <Star className="h-5 w-5" />,
      title: 'Points Economy',
      description: 'Earn points by passing quizzes and completing lessons. Reinvest them to unlock premium content.',
      iconClass: 'bg-amber-500/10 text-amber-600 border-amber-200',
      darkIconClass: 'dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'Verified Certificates',
      description: 'Get blockchain-backed certificates that employers can verify instantly.',
      iconClass: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      darkIconClass: 'dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/20',
    },
    {
      icon: <Globe className="h-5 w-5" />,
      title: 'Global Mentors',
      description: 'Learn from top tech leaders and senior engineers across the globe.',
      iconClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
      darkIconClass: 'dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20',
    },
  ];

  const stats = [
    { value: '5K+', label: 'Premium Courses', icon: <BookOpen className="h-5 w-5 text-primary" /> },
    { value: '2M+', label: 'Active Learners', icon: <Users className="h-5 w-5 text-cyan-500" /> },
    { value: '98%', label: 'Success Rate', icon: <Target className="h-5 w-5 text-emerald-500" /> },
    { value: '50M+', label: 'Points Distributed', icon: <Zap className="h-5 w-5 text-amber-500" /> },
  ];

  const howItWorks = [
    { step: '01', title: 'Enroll for free', desc: 'Browse our catalog and enroll in any course. Starter courses are completely free.' },
    { step: '02', title: 'Learn & earn points', desc: 'Complete lessons and pass quizzes to rack up SkillPoints — our internal currency.' },
    { step: '03', title: 'Unlock & achieve', desc: 'Use your points to access premium content and earn a blockchain-verified certificate.' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ════════════════════════════════════════
          HERO
          ════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center pt-20 pb-16 grain-overlay">

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large violet orb top-left */}
          <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-violet-500/8 blur-[120px] animate-blob" />
          {/* Indigo orb bottom-right */}
          <div className="absolute bottom-0 -right-32 w-[600px] h-[600px] rounded-full bg-indigo-500/8 blur-[140px] animate-blob animation-delay-2000" />
          {/* Cyan orb center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px] animate-blob animation-delay-1000" />
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="flex flex-col items-center text-center">

            {/* Pill badge */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-primary text-sm font-medium mb-8 shadow-sm backdrop-blur-sm"
            >
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Course Recommendations — Now Live
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.04] mb-6"
            >
              <span className="text-foreground">Learn smarter.</span>
              <br />
              <span className="text-gradient">Grow faster.</span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10"
            >
              Join the world's most advanced learning ecosystem. Earn{' '}
              <span className="font-semibold text-amber-500">Skill Points</span> for every milestone
              and forge your path to mastery — free to start.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 items-center mb-16"
            >
              <Link to="/courses">
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary text-base !px-7 !py-3.5 gap-2.5 !rounded-2xl"
                >
                  <PlayCircle className="w-5 h-5" />
                  Explore courses
                </motion.button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-secondary text-base !px-7 !py-3.5 !rounded-2xl"
                  >
                    Claim 500 free points
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
              )}
            </motion.div>

            {/* Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-4xl mx-auto relative"
            >
              {/* Glow behind card */}
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-cyan-500/10 rounded-3xl blur-2xl pointer-events-none" />

              <div className="relative card-base rounded-2xl overflow-hidden shadow-xl border-border">
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/60 border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
                  <div className="ml-4 flex-1 bg-background rounded-md h-5 text-xs text-muted-foreground flex items-center px-3 max-w-48">
                    skillverse.app/my-courses
                  </div>
                </div>
                {/* Mock content */}
                <div className="p-6 grid grid-cols-3 gap-4 bg-background">
                  {/* Left sidebar placeholder */}
                  <div className="col-span-1 space-y-3">
                    <div className="h-8 skeleton rounded-lg" />
                    {[0,1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
                        <div className="w-6 h-6 skeleton rounded-md shrink-0" />
                        <div className="flex-1 h-3 skeleton rounded-full" />
                      </div>
                    ))}
                  </div>
                  {/* Main content */}
                  <div className="col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="h-5 w-36 skeleton rounded-lg mb-1.5" />
                        <div className="h-3 w-24 skeleton rounded-full" />
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold text-amber-600">1,250 pts</span>
                      </div>
                    </div>
                    {/* Course cards */}
                    {[
                      { color: 'bg-violet-500/20', pct: 72, title: 'React Advanced Patterns' },
                      { color: 'bg-cyan-500/20', pct: 45, title: 'Python for Data Science' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                        <div className={`w-10 h-10 rounded-lg ${c.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate mb-2">{c.title}</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${c.pct}%` }}
                                transition={{ delay: 1 + i * 0.2, duration: 0.8, ease: 'easeOut' }}
                                className="h-full progress-bar"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{c.pct}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="hidden lg:flex absolute -left-12 top-8 items-center gap-2.5 card-base px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm"
              >
                <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Achievement</p>
                  <p className="text-sm font-bold text-foreground">Full-Stack Master</p>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="hidden lg:flex absolute -right-12 bottom-12 items-center gap-2.5 card-base px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This week</p>
                  <p className="text-sm font-bold text-foreground">+1,250 Points</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          STATS
          ════════════════════════════════════════ */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div key={i} variants={fadeUp} className="flex flex-col items-center text-center p-5 rounded-2xl hover:bg-muted/60 transition-colors">
                <div className="p-2.5 bg-muted rounded-xl mb-4 ring-1 ring-border">
                  {stat.icon}
                </div>
                <div className="text-3xl font-display font-extrabold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FEATURES
          ════════════════════════════════════════ */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection>
            <motion.div variants={fadeUp} className="text-center mb-16 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold tracking-wide uppercase mb-4">
                <Sparkles className="h-4 w-4" />
                Why SkillVerse
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-5">
                Not just courses.{' '}
                <span className="text-gradient">A career accelerator.</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                We've redesigned the learning experience from the ground up — prioritizing engagement, practical skills, and measurable progress.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="card-base rounded-2xl p-7 group cursor-default transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
                >
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${f.iconClass} ${f.darkIconClass}`}>
                    {f.icon}
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2.5">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </motion.div>
              ))}
            </div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          HOW IT WORKS
          ════════════════════════════════════════ */}
      <section className="py-28 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection>
            <motion.div variants={fadeUp} className="text-center mb-16 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold tracking-wide uppercase mb-4">
                <Layers className="h-4 w-4" />
                How it works
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-5">
                Simple. Rewarding.{' '}
                <span className="text-gradient">Effective.</span>
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-10 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              {howItWorks.map((step, i) => (
                <motion.div key={i} variants={fadeUp} className="flex flex-col items-center text-center relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border-2 border-primary/20 flex items-center justify-center mb-6 relative z-10">
                    <span className="font-display text-2xl font-black text-primary">{step.step}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          GAMIFICATION BANNER
          ════════════════════════════════════════ */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Text */}
              <div>
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm font-semibold mb-6">
                  <Flame className="w-4 h-4" />
                  Gamified Learning
                </motion.div>
                <motion.h2 variants={fadeUp} className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                  Learn, Earn, and{' '}
                  <span className="text-gradient">Level Up.</span>
                </motion.h2>
                <motion.p variants={fadeUp} className="text-muted-foreground text-lg mb-8 leading-relaxed">
                  SkillVerse represents a paradigm shift. Complete modules to earn points, unlock premium content without spending real money, and showcase your achievements to global employers.
                </motion.p>
                <motion.ul variants={stagger} className="space-y-3 mb-10">
                  {['Interactive coding environments', 'Real-time peer discussions', 'Live instructor Q&A sessions', 'Deploy real-world projects'].map((item, i) => (
                    <motion.li key={i} variants={fadeUp} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-foreground/80 text-sm">{item}</span>
                    </motion.li>
                  ))}
                </motion.ul>
                <motion.div variants={fadeUp}>
                  <Link to="/courses" className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all group text-sm">
                    View all courses
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              </div>

              {/* Gamification stat panel */}
              <motion.div variants={fadeUp} className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-violet-500/5 via-indigo-500/5 to-cyan-500/5 rounded-3xl blur-2xl pointer-events-none" />
                <div className="relative card-base rounded-3xl p-8 shadow-xl">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your Progress</p>
                      <p className="font-display text-2xl font-bold text-foreground">Level 12 — Expert</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-primary/20 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    {[
                      { label: 'React Fundamentals', pct: 100, color: 'bg-emerald-500' },
                      { label: 'Node.js APIs', pct: 78, color: 'bg-gradient-to-r from-violet-500 to-indigo-500' },
                      { label: 'System Design', pct: 42, color: 'bg-amber-500' },
                    ].map((c, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground">{c.label}</span>
                          <span className="text-xs text-muted-foreground font-semibold">{c.pct}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${c.color}`}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${c.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9, delay: i * 0.15, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-8">
                    {[
                      { val: '1,250', label: 'Points', icon: <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> },
                      { val: '7', label: 'Day streak', icon: <Flame className="w-4 h-4 text-orange-500" /> },
                      { val: '3', label: 'Certs', icon: <ShieldCheck className="w-4 h-4 text-primary" /> },
                    ].map((s, i) => (
                      <div key={i} className="text-center p-3 rounded-xl bg-muted/60">
                        <div className="flex justify-center mb-1">{s.icon}</div>
                        <div className="font-display text-lg font-bold text-foreground">{s.val}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </InViewSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA BANNER
          ════════════════════════════════════════ */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InViewSection>
            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl overflow-hidden p-12 md:p-20 text-center"
              style={{
                background: 'linear-gradient(135deg, hsl(260 84% 58%) 0%, hsl(234 89% 62%) 50%, hsl(192 91% 52%) 100%)',
              }}
            >
              {/* Subtle dot pattern */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)`,
                  backgroundSize: '24px 24px',
                }}
              />
              {/* Floating gradient shapes */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
              <div className="relative z-10">
                <h2 className="font-display text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
                  Ready to elevate?
                </h2>
                <p className="text-white/80 text-lg md:text-xl mb-10 max-w-xl mx-auto">
                  Join thousands of professionals advancing their careers. Claim your 500 sign-up points instantly.
                </p>
                <Link to={isAuthenticated ? '/courses' : '/register'}>
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-violet-600 font-bold text-lg shadow-xl hover:bg-white/90 transition-all"
                  >
                    {isAuthenticated ? 'Go to Dashboard' : 'Start for free'}
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </InViewSection>
        </div>
      </section>

    </div>
  );
};

export default Home;
