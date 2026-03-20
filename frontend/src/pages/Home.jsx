import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Star, Trophy, ArrowRight, Sparkles, GraduationCap, Target, ChevronDown, Zap, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';


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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center border-b border-border/50 bg-gradient-to-br from-background to-blue-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full pt-20">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-50/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 text-sm mb-8 shadow-sm">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
              <span className="text-muted-foreground text-opacity-90">
                Start with <span className="text-foreground tracking-wide font-semibold">500 free points</span>
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold mb-6 leading-[1.05] tracking-tight text-foreground">
              Master Skills.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Fuel Your Journey.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed text-opacity-90">
              A meticulously designed ecosystem for continuous learning. Earn points for every course you finish, and reinvest them into unlocking new opportunities. No subscription required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-20">
              <Link to="/courses">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-base rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Explore Courses
                </Button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <Button size="lg" variant="outline" className="border border-border bg-card text-foreground hover:bg-blue-100 hover:text-blue-800 font-medium px-8 py-6 text-base rounded-lg shadow-sm transition-all duration-300">
                    Create an Account
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative py-16 border-b border-border/50 bg-card shadow-sm shadow-blue-900/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border/30">
            {stats.map((stat, index) => (
              <div key={index} className={`pl-8 ${index === 0 ? 'pl-0 border-transparent' : ''} group`}>
                <div className="inline-flex items-center gap-2 text-primary mb-2">
                  {stat.icon}
                  <span className="text-sm font-medium tracking-wide uppercase text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Points System Explainer */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-4xl font-bold text-foreground mb-6 tracking-tight">An Ecosystem Built on Growth.</h2>
            <p className="text-muted-foreground text-opacity-80 text-lg leading-relaxed">Our points-based structural model ensures learning is accessible, rewarding, and deeply engaging. Here is how your journey unfolds.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300 group flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors">
                <Star className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground tracking-tight">1. Immediate Access</h3>
              <p className="text-muted-foreground text-opacity-90 leading-relaxed">Sign up and receive 500 points instantly. Enough to comfortably explore your first few beginner courses.</p>
            </div>
            <div className="p-8 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:shadow-blue-500/5 transition-all duration-300 group flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground tracking-tight">2. Invest in Learning</h3>
              <p className="text-muted-foreground text-opacity-90 leading-relaxed">Exchange points to enroll. From beginner introductions to advanced masterclasses, each course is priced fairly.</p>
            </div>
            <div className="p-8 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:shadow-purple-500/5 transition-all duration-300 group flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-100 transition-colors">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground tracking-tight">3. Earn & Reinvest</h3>
              <p className="text-muted-foreground text-opacity-90 leading-relaxed">Successful completion of courses yields a return on points. Fueling a continuous, uninhibited learning cycle.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-4xl font-bold text-foreground mb-6 tracking-tight">Why SkillVerse?</h2>
            <p className="text-muted-foreground text-opacity-80 text-lg leading-relaxed">Everything you need to master your craft and share your knowledge, securely powered by our points architecture.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-8 rounded-2xl border border-border bg-card hover:bg-blue-50/50 transition-all duration-500 group cursor-default h-full shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-blue-200`}
              >
                <div className="mb-6 opacity-90 group-hover:scale-110 transition-transform duration-300 text-blue-600">
                  {React.cloneElement(feature.icon, { className: 'h-8 w-8' })}
                </div>
                <h3 className="text-lg font-bold mb-3 text-foreground tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground text-opacity-90 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 relative overflow-hidden border-t border-border bg-gradient-to-tr from-blue-100 via-card to-blue-50">
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-black mb-6 text-foreground tracking-tight">
            Ready to Begin?
          </h2>
          <p className="text-muted-foreground mb-12 text-xl max-w-xl mx-auto leading-relaxed">
            Join the ecosystem today. Claim your initial 500 points and start charting your educational footprint.
          </p>
          <Link to={isAuthenticated ? "/courses" : "/register"}>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-10 py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              {isAuthenticated ? 'Enter the Platform' : 'Initialize Your Account'}
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
