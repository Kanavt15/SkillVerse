import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, Star, Trophy, ArrowRight, Sparkles,
  GraduationCap, Target, Zap, Globe, CheckCircle2, TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <GraduationCap className="h-6 w-6" />,
      title: 'Learn New Skills',
      description: 'Diverse courses taught by expert instructors across all skill levels.',
      color: 'from-violet-500/20 to-indigo-500/10',
      iconBg: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    },
    {
      icon: <Star className="h-6 w-6" />,
      title: 'Earn Points',
      description: 'Complete courses to earn points. Reinvest them into new learning opportunities.',
      color: 'from-amber-500/20 to-yellow-500/10',
      iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: 'Track Progress',
      description: 'Monitor your journey with intuitive progress tracking for every course.',
      color: 'from-emerald-500/20 to-teal-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: 'Teach & Earn',
      description: 'Share expertise by creating courses. Build your reputation while you earn.',
      color: 'from-pink-500/20 to-rose-500/10',
      iconBg: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
    },
  ];

  const stats = [
    { value: '500+', label: 'Courses', icon: <BookOpen className="h-5 w-5 text-violet-400" /> },
    { value: '10K+', label: 'Learners', icon: <Users className="h-5 w-5 text-indigo-400" /> },
    { value: '200+', label: 'Instructors', icon: <Globe className="h-5 w-5 text-emerald-400" /> },
    { value: '50K+', label: 'Points Earned', icon: <Zap className="h-5 w-5 text-amber-400" /> },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Immediate Access',
      desc: 'Sign up and instantly receive 500 points — enough to start your first courses right away.',
      icon: <Star className="h-5 w-5 text-amber-400" />,
      accent: 'border-amber-500/20 hover:border-amber-500/40',
    },
    {
      step: '02',
      title: 'Invest in Learning',
      desc: 'Spend points to enroll in courses. From beginner to advanced, priced fairly for everyone.',
      icon: <BookOpen className="h-5 w-5 text-violet-400" />,
      accent: 'border-violet-500/20 hover:border-violet-500/40',
    },
    {
      step: '03',
      title: 'Earn & Reinvest',
      desc: 'Completing courses returns points. A continuous learning cycle with no subscriptions needed.',
      icon: <Trophy className="h-5 w-5 text-emerald-400" />,
      accent: 'border-emerald-500/20 hover:border-emerald-500/40',
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-violet-600/8 blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[80px]" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full py-20">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-sm text-violet-300 font-medium">
                Start with <strong className="text-white">500 free points</strong> — no credit card needed
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-[1.05]">
              <span className="text-white">Master Skills.</span>
              <br />
              <span className="text-gradient">Fuel Your Journey.</span>
            </h1>

            <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] mb-10 max-w-xl leading-relaxed">
              A points-powered learning ecosystem. Earn by completing courses. Spend to unlock new ones. 
              No subscriptions, just progress.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link to="/courses">
                <button className="btn-primary flex items-center gap-2 text-base !px-8 !py-3.5 glow-violet">
                  <BookOpen className="h-5 w-5" />
                  Explore Courses
                </button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <button className="btn-outline-violet flex items-center gap-2 text-base !px-8 !py-3.5">
                    Create Free Account
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              )}
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-5 text-sm text-[hsl(var(--muted-foreground))]">
              {['No monthly fees', 'Points-based access', 'Earn while you learn'].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="relative py-16">
        <div className="section-divider mb-16" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="stat-card text-center group">
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="section-divider mt-16" />
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
              Built on Growth.
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-lg max-w-xl leading-relaxed">
              Our points-based model makes learning accessible, rewarding, and continuously engaging.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {howItWorks.map((item, idx) => (
              <div
                key={idx}
                className={`relative p-8 rounded-2xl border bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 group ${item.accent}`}
              >
                <div className="absolute top-6 right-6 text-5xl font-black text-white/4 select-none">
                  {item.step}
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">Why SkillVerse</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
              Everything in one place.
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-lg max-w-xl leading-relaxed">
              From learning to teaching, our platform covers every angle of your skill journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl border border-white/5 bg-gradient-to-br ${f.color} transition-all duration-300 hover:-translate-y-1 hover:border-white/10 group cursor-default`}
              >
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-5 ${f.iconBg} group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-32 relative overflow-hidden">
        <div className="section-divider mb-32" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-violet-600/12 rounded-full blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 rounded-full px-4 py-1.5 mb-8">
            <TrendingUp className="h-4 w-4 text-violet-400" />
            <span className="text-sm text-violet-300 font-medium">Join 10,000+ learners</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Ready to Begin<span className="text-gradient">?</span>
          </h2>
          <p className="text-[hsl(var(--muted-foreground))] mb-10 text-xl max-w-lg mx-auto leading-relaxed">
            Claim your 500 free points and start your learning journey today.
          </p>
          <Link to={isAuthenticated ? '/courses' : '/register'}>
            <button className="btn-primary text-base !px-10 !py-4 glow-violet flex items-center gap-2.5 mx-auto">
              {isAuthenticated ? 'Enter the Platform' : 'Start Learning Free'}
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
