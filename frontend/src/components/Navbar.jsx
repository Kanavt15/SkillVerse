import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Terminal, BookOpen, LayoutGrid, GraduationCap, Lock, Sun, Moon,
    Menu, X, LogOut, User as UserIcon, Zap, Flame,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationDropdown from './NotificationDropdown';

/**
 * Primary navigation.
 *
 * Two deliberate changes from the old bar:
 *
 * 1. "Teach" is always present, and shows a LOCK with its unlock level when
 *    the learner has not earned it. Hiding it entirely — which is what the old
 *    nav did — meant the product's central promise was invisible to exactly
 *    the people who needed to see it.
 *
 * 2. The role check now reads `canTeach`, a capability, instead of testing
 *    `role !== 'learner'`. The old negative test disagreed with the route
 *    guard, so an unrecognised role showed a link that then bounced.
 */

const UNLOCK_LEVEL = 10;

export default function Navbar() {
    const { isAuthenticated, user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();

    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const canTeach = user?.canTeach ?? false;

    const links = [
        { to: '/courses', label: 'Learn', icon: BookOpen },
        { to: '/practice', label: 'Practice', icon: Terminal },
        ...(isAuthenticated ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutGrid }] : []),
    ];

    const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <header
            className={`fixed top-0 inset-x-0 z-50 transition-colors duration-200 ${scrolled
                ? 'bg-background/90 backdrop-blur-md border-b border-border'
                : 'bg-background/60 border-b border-transparent'
                }`}
        >
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">

                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                    <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center text-primary-foreground font-mono font-bold text-sm shadow-signal transition-transform group-hover:scale-105">
                        S
                    </div>
                    <span className="font-display text-lg font-bold hidden sm:block">
                        Skill<span className="text-primary">Verse</span>
                    </span>
                </Link>

                {/* Desktop links */}
                <div className="hidden md:flex items-center gap-1 ml-4">
                    {links.map(({ to, label, icon: Icon }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`nav-link flex items-center gap-1.5 ${isActive(to) ? 'nav-link-active' : ''}`}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Link>
                    ))}

                    {isAuthenticated && <TeachLink canTeach={canTeach} active={isActive('/instructor')} />}
                </div>

                {/* Right cluster */}
                <div className="ml-auto flex items-center gap-1.5">
                    {isAuthenticated && (
                        <div className="hidden lg:flex items-center gap-1.5 mr-1">
                            <Pill icon={Zap} value={(user?.xp ?? 0).toLocaleString()} title="XP" />
                            {user?.streak?.current > 0 && (
                                <Pill icon={Flame} value={user.streak.current} title="Day streak" />
                            )}
                        </div>
                    )}

                    <button
                        onClick={toggleTheme}
                        className="btn-ghost !px-2"
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                    >
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>

                    {isAuthenticated ? (
                        <>
                            <NotificationDropdown />
                            <Link
                                to="/profile"
                                className="h-8 w-8 rounded-lg bg-surface-2 border border-border grid place-items-center text-sm font-semibold hover:border-border-strong transition-colors"
                                title={user?.full_name}
                            >
                                {user?.full_name?.charAt(0)?.toUpperCase() || <UserIcon className="h-4 w-4" />}
                            </Link>
                            <button onClick={handleLogout} className="btn-ghost !px-2 hidden sm:inline-flex" aria-label="Log out">
                                <LogOut className="h-4 w-4" />
                            </button>
                        </>
                    ) : (
                        <div className="hidden sm:flex items-center gap-2">
                            <Link to="/login" className="btn-ghost">Log in</Link>
                            <Link to="/register" className="btn-primary">Get started</Link>
                        </div>
                    )}

                    <button
                        onClick={() => setMobileOpen((v) => !v)}
                        className="btn-ghost !px-2 md:hidden"
                        aria-label="Menu"
                        aria-expanded={mobileOpen}
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </nav>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden overflow-hidden bg-background border-b border-border"
                    >
                        <div className="px-4 py-3 space-y-1">
                            {links.map(({ to, label, icon: Icon }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${isActive(to) ? 'bg-surface-2 text-foreground' : 'text-muted-foreground'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" /> {label}
                                </Link>
                            ))}

                            {isAuthenticated ? (
                                <>
                                    <TeachLink canTeach={canTeach} mobile />
                                    <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground">
                                        <UserIcon className="h-4 w-4" /> Profile
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground"
                                    >
                                        <LogOut className="h-4 w-4" /> Log out
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-2 pt-2">
                                    <Link to="/login" className="btn-secondary flex-1">Log in</Link>
                                    <Link to="/register" className="btn-primary flex-1">Get started</Link>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}

/**
 * Teaching entry point. Locked state is shown, not hidden — the whole product
 * is about earning this, so it has to be visible while still out of reach.
 */
function TeachLink({ canTeach, active, mobile }) {
    if (canTeach) {
        return (
            <Link
                to="/instructor/dashboard"
                className={mobile
                    ? 'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-violet'
                    : `nav-link flex items-center gap-1.5 !text-violet ${active ? 'nav-link-active' : ''}`}
            >
                <GraduationCap className="h-4 w-4" /> Teach
            </Link>
        );
    }

    return (
        <Link
            to="/dashboard"
            title={`Unlocks at level ${UNLOCK_LEVEL} — see your progress`}
            className={mobile
                ? 'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground/70'
                : 'nav-link flex items-center gap-1.5 !text-muted-foreground/70 cursor-help'}
        >
            <GraduationCap className="h-4 w-4" />
            Teach
            <Lock className="h-3 w-3" />
            <span className="label-mono !text-[0.6rem] hidden lg:inline">lv {UNLOCK_LEVEL}</span>
        </Link>
    );
}

const Pill = ({ icon: Icon, value, title }) => (
    <span
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 border border-border"
        title={title}
    >
        <Icon className="h-3.5 w-3.5 text-amber" />
        <span className="numeral text-xs font-semibold">{value}</span>
    </span>
);
