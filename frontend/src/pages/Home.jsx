import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Star, Trophy, ArrowRight, Sparkles, GraduationCap, Target, ChevronDown, Zap, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import ScrollAnimation from '../components/ScrollAnimation';

const Home = () => {
  const { isAuthenticated, points } = useAuth();

  const features = [
    {
      icon: <GraduationCap className="h-8 w-8 text-cyan-400" />,
      title: 'Learn New Skills',
      description: 'Access a diverse catalog of courses taught by expert instructors across all skill levels.',
      gradient: 'from-cyan-500/10 to-blue-500/10',
      borderHover: 'hover:border-cyan-500/30',
    },
    {
      icon: <Star className="h-8 w-8 text-amber-400" />,
      title: 'Earn Points',
      description: 'Complete courses to earn points. Use them to unlock even more learning opportunities.',
      gradient: 'from-amber-500/10 to-yellow-500/10',
      borderHover: 'hover:border-amber-500/30',
    },
    {
      icon: <Target className="h-8 w-8 text-emerald-400" />,
      title: 'Track Progress',
      description: 'Monitor your learning journey with detailed progress tracking for every course.',
      gradient: 'from-emerald-500/10 to-teal-500/10',
      borderHover: 'hover:border-emerald-500/30',
    },
    {
      icon: <Sparkles className="h-8 w-8 text-purple-400" />,
      title: 'Teach & Earn Points',
      description: 'Share your expertise by creating courses. Help others learn while building your reputation.',
      gradient: 'from-purple-500/10 to-pink-500/10',
      borderHover: 'hover:border-purple-500/30',
    }
  ];

  const stats = [
    { value: '500+', label: 'Courses Available', icon: <BookOpen className="h-5 w-5" /> },
    { value: '10K+', label: 'Active Learners', icon: <Users className="h-5 w-5" /> },
    { value: '200+', label: 'Expert Instructors', icon: <Globe className="h-5 w-5" /> },
    { value: '50K+', label: 'Points Earned', icon: <Zap className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center">
        {/* Cosmic background effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.15)_0%,_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(212,168,67,0.08)_0%,_transparent_50%)]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        </div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAxMHY2aC02VjE0aDZ6bTAgMTB2NmgtNlYyNGg2em0xMC0yMHY2aC02VjE0aDZ6bTAgMTB2NmgtNlYyNGg2em0wIDEwdjZoLTZWMzRoNnptLTIwLTIwdjZoLTZWMTRoNnptMCAxMHY2aC02VjI0aDZ6bTAgMTB2NmgtNlYzNGg2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-full px-5 py-2.5 text-sm mb-8 animate-float" style={{ animationDuration: '4s' }}>
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="text-slate-300">Start with <span className="text-gold font-semibold">500 free points</span> — learn anything</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[0.95] tracking-tight">
              <span className="text-white">Learn, Grow &</span>
              <br />
              <span className="text-gold">Earn Points</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Complete courses to earn points. Use them to unlock new skills.
              The more you learn, the more you can learn.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link to="/courses">
                <Button size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-[#0a0e1a] font-bold px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-400/40 hover:scale-[1.02]">
                  <BookOpen className="h-5 w-5 mr-2" />
                  Explore Courses
                </Button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <Button size="lg" variant="outline" className="border-2 border-white/10 text-white hover:bg-white/[0.06] hover:border-cyan-500/30 font-semibold px-8 py-6 text-lg rounded-xl transition-all duration-300">
                    Get 500 Free Points
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Scroll hint */}
            <div className="flex flex-col items-center gap-2 text-slate-500 animate-bounce">
              <span className="text-xs uppercase tracking-widest">Scroll to explore</span>
              <ChevronDown className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      {/* Scroll Animation Section */}
      <ScrollAnimation />

      {/* Stats Bar */}
      <section className="relative py-12 border-y border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.03] via-transparent to-amber-500/[0.03]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 mb-3 group-hover:bg-cyan-500/20 transition-colors">
                  {stat.icon}
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Points System Explainer */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How Points Work</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">Our points-based system makes learning accessible. No real money needed.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-8 rounded-2xl glass-dark glass-dark-hover transition-all duration-300 group">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:bg-emerald-500/20 transition-colors group-hover:animate-glow-pulse">
                <Star className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-white">1. Get Points</h3>
              <p className="text-slate-400 leading-relaxed">Sign up and receive 500 points instantly. Enough to enroll in multiple beginner courses.</p>
            </div>
            <div className="text-center p-8 rounded-2xl glass-dark glass-dark-hover transition-all duration-300 group">
              <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:bg-cyan-500/20 transition-colors">
                <BookOpen className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-white">2. Spend to Learn</h3>
              <p className="text-slate-400 leading-relaxed">Beginner: 50 pts • Intermediate: 100 pts • Advanced: 200 pts — invest in your growth.</p>
            </div>
            <div className="text-center p-8 rounded-2xl glass-dark glass-dark-hover transition-all duration-300 group">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:bg-purple-500/20 transition-colors">
                <Trophy className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-white">3. Earn More</h3>
              <p className="text-slate-400 leading-relaxed">Complete courses to earn even more points. Keep the learning cycle going!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why SkillVerse?</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">Everything you need to learn and teach, powered by our unique points system.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl border border-white/[0.06] ${feature.borderHover} hover:shadow-lg transition-all duration-500 bg-gradient-to-b ${feature.gradient} group cursor-default`}
              >
                <div className="mb-5 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-white">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-amber-500/[0.05]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
            Ready to start <span className="text-gold">learning</span>?
          </h2>
          <p className="text-slate-400 mb-10 text-lg max-w-xl mx-auto">
            Join SkillVerse today and get 500 points to start your journey.
          </p>
          <Link to={isAuthenticated ? "/courses" : "/register"}>
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-[#0a0e1a] font-bold px-10 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-400/40 hover:scale-[1.02]">
              {isAuthenticated ? 'Browse Courses' : 'Get Started Free'}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer space */}
      <div className="h-8" />
    </div>
  );
};

export default Home;
