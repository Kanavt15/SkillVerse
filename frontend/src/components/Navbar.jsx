import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, User, Menu, Star, X, Zap, GraduationCap } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

const Navbar = () => {
  const { user, logout, isAuthenticated, points, refreshPoints } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (isAuthenticated) refreshPoints();
  }, [location.pathname, isAuthenticated]);

  // Close mobile menu on route change
  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  const navLinks = [
    { to: '/courses', label: 'Browse', icon: <BookOpen className="h-4 w-4" /> },
    ...(isAuthenticated ? [
      { to: '/my-courses', label: 'My Learning', icon: <GraduationCap className="h-4 w-4" /> },
      ...(user?.role !== 'learner' ? [{ to: '/instructor/dashboard', label: 'Teach', icon: <Zap className="h-4 w-4" /> }] : []),
    ] : []),
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[hsl(225,30%,8%)]/90 backdrop-blur-xl shadow-xl shadow-black/30 border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Skill<span className="text-gradient">Verse</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.to
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Right */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Points Badge */}
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 cursor-default group hover:bg-amber-500/15 transition-colors">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-amber-300">{(points || 0).toLocaleString()}</span>
                  <span className="text-xs text-amber-500/70">pts</span>
                </div>

                {/* Notifications */}
                <NotificationDropdown />

                {/* Profile */}
                <Link to="/profile">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg hover:shadow-violet-500/40 transition-shadow cursor-pointer">
                    {user?.full_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                  </div>
                </Link>

                {/* Logout */}
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm !px-5 !py-2 glow-violet-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-white/5 transition-all"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[hsl(225,30%,9%)]/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.to
                    ? 'bg-violet-500/15 text-violet-300'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-white/5'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            <div className="border-t border-white/5 pt-3 mt-3 space-y-1">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-bold text-amber-300">{(points || 0).toLocaleString()} points</span>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-white/5 transition-all"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/8 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-white/5 transition-all"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center justify-center gap-2 mx-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
