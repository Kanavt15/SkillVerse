import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { BookOpen, LogOut, User, Menu, Star, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isAuthenticated, points, refreshPoints } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Auto-refresh points from server on route change
  useEffect(() => {
    if (isAuthenticated) {
      refreshPoints();
    }
  }, [location.pathname, isAuthenticated]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isHome
      ? 'bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-white/[0.06]'
      : 'bg-[#0f1629]/95 backdrop-blur-xl border-b border-white/[0.08] shadow-lg shadow-black/20'
      }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 group">
              <BookOpen className="h-7 w-7 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              <span className="text-xl font-bold text-white group-hover:text-cyan-100 transition-colors">
                SkillVerse
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <Link to="/courses">
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/[0.06]">
                Browse Courses
              </Button>
            </Link>

            {isAuthenticated ? (
              <>
                <Link to="/my-courses">
                  <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/[0.06]">
                    My Courses
                  </Button>
                </Link>
                {user?.role !== 'learner' && (
                  <Link to="/instructor/dashboard">
                    <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/[0.06]">
                      Teach
                    </Button>
                  </Link>
                )}

                {/* Points Balance */}
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-amber-300">{points?.toLocaleString() || 0}</span>
                  <span className="text-xs text-amber-400/70">pts</span>
                </div>

                <Link to="/profile">
                  <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/[0.06]">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={logout}
                  className="border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06] hover:border-white/20"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/[0.06]">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-cyan-500 hover:bg-cyan-400 text-[#0a0e1a] font-semibold transition-all duration-300 shadow-lg shadow-cyan-500/20">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-300 hover:text-white hover:bg-white/[0.06]"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0f1629]/98 backdrop-blur-xl">
          <div className="px-4 pt-3 pb-4 space-y-1">
            <Link
              to="/courses"
              className="block px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse Courses
            </Link>
            {isAuthenticated ? (
              <>
                {/* Mobile Points Balance */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-amber-300">{points?.toLocaleString() || 0} points</span>
                </div>
                <Link
                  to="/my-courses"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Courses
                </Link>
                {user?.role !== 'learner' && (
                  <Link
                    to="/instructor/dashboard"
                    className="block px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Teach
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
