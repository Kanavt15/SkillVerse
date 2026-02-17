import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Star, Trophy, ArrowRight, Sparkles, GraduationCap, Target } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, points } = useAuth();

  const features = [
    {
      icon: <GraduationCap className="h-8 w-8 text-blue-500" />,
      title: 'Learn New Skills',
      description: 'Access a diverse catalog of courses taught by expert instructors across all skill levels.'
    },
    {
      icon: <Star className="h-8 w-8 text-amber-500" />,
      title: 'Earn Points',
      description: 'Complete courses to earn points. Use them to unlock even more learning opportunities.'
    },
    {
      icon: <Target className="h-8 w-8 text-green-500" />,
      title: 'Track Progress',
      description: 'Monitor your learning journey with detailed progress tracking for every course.'
    },
    {
      icon: <Sparkles className="h-8 w-8 text-purple-500" />,
      title: 'Teach & Earn Points',
      description: 'Share your expertise by creating courses. Help others learn while building your reputation.'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAxMHY2aC02VjE0aDZ6bTAgMTB2NmgtNlYyNGg2em0xMC0yMHY2aC02VjE0aDZ6bTAgMTB2NmgtNlYyNGg2em0wIDEwdjZoLTZWMzRoNnptLTIwLTIwdjZoLTZWMTRoNnptMCAxMHY2aC02VjI0aDZ6bTAgMTB2NmgtNlYzNGg2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-full px-4 py-2 text-sm mb-6">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span>Start with 500 free points — learn anything</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Learn, Grow &<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400">Earn Points</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Complete courses to earn points. Use them to unlock new skills.
              The more you learn, the more you can learn.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/courses">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-900/30">
                  <BookOpen className="h-5 w-5 mr-2" />
                  Explore Courses
                </Button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg rounded-xl">
                    Get 500 Free Points
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Points System Explainer */}
      <section className="py-16 bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How Points Work</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Our points-based system makes learning accessible. No real money needed.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-white shadow-sm border">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Star className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">1. Get Points</h3>
              <p className="text-gray-600">Sign up and receive 500 points instantly. Enough to enroll in multiple beginner courses.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-white shadow-sm border">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">2. Spend to Learn</h3>
              <p className="text-gray-600">Beginner: 50 pts • Intermediate: 100 pts • Advanced: 200 pts — invest in your growth.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-white shadow-sm border">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">3. Earn More</h3>
              <p className="text-gray-600">Complete courses to earn even more points. Keep the learning cycle going!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why SkillVerse?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Everything you need to learn and teach, powered by our unique points system.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 bg-white group">
                <div className="mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start learning?</h2>
          <p className="text-gray-600 mb-8 text-lg">Join SkillVerse today and get 500 points to start your journey.</p>
          <Link to={isAuthenticated ? "/courses" : "/register"}>
            <Button size="lg" className="px-8 py-6 text-lg rounded-xl">
              {isAuthenticated ? 'Browse Courses' : 'Get Started Free'}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
