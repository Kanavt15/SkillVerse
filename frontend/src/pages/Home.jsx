import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, Star, Trophy, ArrowRight, Sparkles,
  GraduationCap, Target, Zap, Globe, CheckCircle2, TrendingUp,
  PlayCircle, Code, ShieldCheck, Flame
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <Code className="h-6 w-6" />,
      title: 'Industry-Ready Skills',
      description: 'Master in-demand technologies through practical, hands-on courses.',
      color: 'from-blue-500/20 to-cyan-500/10',
      iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30 text-blue-400',
    },
    {
      icon: <Star className="h-6 w-6" />,
      title: 'Points Economy',
      description: 'Earn points by passing quizzes. Reinvest to unlock premium content.',
      color: 'from-amber-500/20 to-orange-500/10',
      iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-amber-400',
    },
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: 'Verified Certificates',
      description: 'Get verifiable blockchain-backed certificates for completed courses.',
      color: 'from-emerald-500/20 to-teal-500/10',
      iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-emerald-400',
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: 'Global Mentors',
      description: 'Learn directly from top tech leaders and senior engineers worldwide.',
      color: 'from-pink-500/20 to-rose-500/10',
      iconBg: 'bg-pink-500/20 text-pink-400 border-pink-500/30 text-pink-400',
    },
  ];

  const stats = [
    { value: '5K+', label: 'Premium Courses', icon: <BookOpen className="h-5 w-5 text-violet-400" /> },
    { value: '2M+', label: 'Active Learners', icon: <Users className="h-5 w-5 text-indigo-400" /> },
    { value: '98%', label: 'Success Rate', icon: <Target className="h-5 w-5 text-emerald-400" /> },
    { value: '50M+', label: 'Points Distributed', icon: <Zap className="h-5 w-5 text-amber-400" /> },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden selection:bg-violet-500/30">
      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center pt-24 pb-12">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/3 w-[700px] h-[700px] bg-fuchsia-600/10 rounded-full mix-blend-screen filter blur-[120px] animate-blob animation-delay-4000" />
          
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-full px-5 py-2 mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(124,92,233,0.15)] animate-fade-in-up">
            <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-sm font-medium tracking-wide text-violet-200">
              New: AI-Powered Course Recommendations
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight">
            <span className="text-white block mb-2">Unlock Your</span>
            <span className="bg-clip-text text-transparent bg-[linear-gradient(to_right,theme(colors.violet.400),theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.violet.400))] bg-[length:200%_auto] animate-text-gradient">
              True Potential.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] mb-12 max-w-2xl leading-relaxed mx-auto font-light">
            Join the world's most advanced learning ecosystem. Earn <span className="text-amber-400 font-medium">Skill Points</span> for every milestone, and forge your path to mastery.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-5 items-center justify-center">
            <Link to="/courses">
              <button className="relative group inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-violet-600 rounded-xl hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-background overflow-hidden">
                <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black" />
                <span className="relative flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Explore Catalog
                </span>
                <span className="absolute inset-0 border-2 border-white/20 rounded-xl" />
              </button>
            </Link>
            {!isAuthenticated && (
              <Link to="/register">
                <button className="relative group inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-white/5 rounded-xl hover:bg-white/10 border border-white/10 hover:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 overflow-hidden">
                  <span className="relative flex items-center gap-2">
                    Claim 500 Free Points
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
            )}
          </div>

          {/* Floating UI Elements (Decorative) */}
          <div className="hidden lg:block absolute top-[10%] left-[5%] shadow-2xl glass p-4 rounded-2xl animate-float opacity-80 rotate-[-5deg]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Trophy className="text-amber-400 w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs text-amber-200">Achievement</p>
                <p className="text-sm font-bold text-white">Full-Stack Master</p>
              </div>
            </div>
          </div>

          <div className="hidden lg:block absolute bottom-[20%] right-[5%] shadow-2xl glass p-4 rounded-2xl animate-float-delayed opacity-80 rotate-[5deg]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="text-emerald-400 w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs text-emerald-200">Skill Level</p>
                <p className="text-sm font-bold text-white">+1,250 Points</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dynamic Stats Marquee/Grid ── */}
      <section className="relative py-12 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center text-center p-4">
                <div className="mb-3 p-3 bg-white/5 rounded-2xl ring-1 ring-white/10">
                  {stat.icon}
                </div>
                <div className="text-4xl font-extrabold text-white mb-1 shadow-sm">{stat.value}</div>
                <div className="text-sm font-medium tracking-wide text-[hsl(var(--muted-foreground))] uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <span className="text-violet-400 font-semibold tracking-wider uppercase text-sm mb-4 block">The Advantage</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Not just courses. <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">A career accelerator.</span>
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-lg leading-relaxed">
              We've redesigned the learning experience from the ground up, prioritizing engagement, practical skills, and measurable progress.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, idx) => (
              <div
                key={idx}
                className="relative group p-8 rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden hover:border-violet-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-2"
              >
                {/* Hover gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className={`relative z-10 w-14 h-14 rounded-2xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg ${f.iconBg}`}>
                  {f.icon}
                </div>
                <h3 className="relative z-10 text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="relative z-10 text-[hsl(var(--muted-foreground))] leading-relaxed text-sm">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Immersive Interactive Section ── */}
      <section className="py-32 relative overflow-hidden bg-black/40 border-y border-white/5">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-violet-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-blue-600/10 blur-[150px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-6">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-semibold tracking-wide">Gamified Learning</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Learn, Earn, and <br/>
                <span className="text-gradient">Level Up.</span>
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] text-lg mb-8 leading-relaxed">
                SkillVerse represents a paradigm shift. Complete modules to earn points, unlock premium content without spending real money, and showcase your verifiable achievements to global employers.
              </p>
              
              <ul className="space-y-4 mb-10">
                {['Interactive coding environments', 'Real-time peer discussions', 'Live instructor Q&A sessions', 'Deploy real-world projects'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-white/80">{item}</span>
                  </li>
                ))}
              </ul>
              
              <Link to="/courses" className="inline-flex items-center gap-2 text-violet-400 font-bold hover:text-violet-300 transition-colors group">
                View Curriculum
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            {/* 3D-like Floating Dashboard Mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-3xl blur-2xl opacity-20 animate-pulse-slow" />
              <div className="relative rounded-3xl border border-white/10 bg-[#0A0D1E]/80 backdrop-blur-xl p-2 shadow-2xl transform rotate-1 hover:rotate-0 hover:scale-[1.02] transition-all duration-500">
                {/* Mockup Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                {/* Mockup Content */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="h-4 w-32 bg-white/10 rounded-full" />
                    <div className="h-8 w-24 bg-violet-500/20 rounded-full border border-violet-500/30" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-24 w-full bg-white/5 rounded-2xl flex items-center p-4 gap-4">
                       <div className="h-12 w-12 rounded-xl bg-blue-500/20" />
                       <div className="flex-1 space-y-2">
                         <div className="h-3 w-1/2 bg-white/20 rounded-full" />
                         <div className="h-2 w-3/4 bg-white/10 rounded-full" />
                       </div>
                    </div>
                    <div className="h-24 w-full bg-white/5 rounded-2xl flex items-center p-4 gap-4">
                       <div className="h-12 w-12 rounded-xl bg-emerald-500/20" />
                       <div className="flex-1 space-y-2">
                         <div className="h-3 w-1/3 bg-white/20 rounded-full" />
                         <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-900/20 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight">
            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Elevate?</span>
          </h2>
          <p className="text-[hsl(var(--muted-foreground))] mb-12 text-xl max-w-2xl mx-auto leading-relaxed">
            Join thousands of professionals advancing their careers. Claim your 500 sign-up points instantly.
          </p>
          <Link to={isAuthenticated ? '/courses' : '/register'}>
            <button className="relative group inline-flex items-center justify-center px-10 py-5 font-extrabold text-white transition-all duration-300 bg-white rounded-2xl hover:bg-gray-100 shadow-[0_0_40px_rgba(124,92,233,0.3)] hover:shadow-[0_0_60px_rgba(124,92,233,0.5)] hover:-translate-y-1 text-lg text-violet-950">
              {isAuthenticated ? 'Go to Dashboard' : 'Start Learning For Free'}
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
