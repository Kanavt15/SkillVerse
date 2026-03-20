import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { BookOpen, LogOut, User, Menu, Star, X } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

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
      ? 'bg-background/80 backdrop-blur-xl border-b border-border'
      : 'bg-background/95 backdrop-blur-xl border-b border-border shadow-lg shadow-black/20'
      }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 group">
              <BookOpen className="h-7 w-7 text-primary group-hover:text-primary/80 transition-colors" />
              <span className="text-xl font-bold text-foreground transition-colors">
                SkillVerse
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Link to="/courses">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 transition-all duration-300 hover:scale-105 rounded-lg px-4">
                Browse Courses
              </Button>
            </Link>

            {isAuthenticated ? (
              <>
                <Link to="/my-courses">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 transition-all duration-300 hover:scale-105 rounded-lg px-4">
                    My Courses
                  </Button>
                </Link>
                {user?.role !== 'learner' && (
                  <Link to="/instructor/dashboard">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 transition-all duration-300 hover:scale-105 rounded-lg px-4">
                      Teach
                    </Button>
                  </Link>
                )}

                {/* Points Balance */}
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 hover:border-amber-300 rounded-full px-4 py-1.5 transition-all duration-300 cursor-default hover:shadow-md hover:-translate-y-0.5 mx-2">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 animate-[pulse_3s_ease-in-out_infinite]" />
                  <span className="text-sm font-bold text-amber-600">{points?.toLocaleString() || 0}</span>
                  <span className="text-xs text-amber-500/80">pts</span>
                </div>

                {/* Notifications Bell */}
                <NotificationDropdown />

                <Link to="/profile">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 transition-all duration-300 hover:scale-110 hover:rotate-3 rounded-full mx-1 shadow-sm border border-transparent hover:border-border">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={logout}
                  className="border-border bg-card text-muted-foreground hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-all duration-300 rounded-lg ml-2 hover:shadow-sm"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 transition-all duration-300 hover:scale-105 rounded-lg px-4 mr-2">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 transition-all duration-300 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
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
              className="text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background/98 backdrop-blur-xl">
          <div className="px-4 pt-3 pb-4 space-y-1">
            <Link
              to="/courses"
              className="block px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm transition-colors"
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
                {/* Mobile Notifications */}
                <div className="px-4 py-2">
                  <NotificationDropdown />
                </div>
                <Link
                  to="/my-courses"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Courses
                </Link>
                {user?.role !== 'learner' && (
                  <Link
                    to="/instructor/dashboard"
                    className="block px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Teach
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border shadow-sm transition-colors"
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
