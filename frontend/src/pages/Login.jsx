import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Label } from '../components/ui/label';
import {
  BookOpen, Eye, EyeOff, Loader2, ArrowLeft,
  GraduationCap, Star, Trophy, Zap, CheckCircle2
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: d, ease: [0.16, 1, 0.3, 1] } }),
};

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!', 'You have successfully logged in');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const highlights = [
    { icon: <GraduationCap className="w-4 h-4" />, text: '5,000+ premium courses' },
    { icon: <Star className="w-4 h-4" />, text: 'Earn points as you learn' },
    { icon: <Trophy className="w-4 h-4" />, text: 'Blockchain-verified certs' },
    { icon: <Zap className="w-4 h-4" />, text: 'AI-powered recommendations' },
  ];

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left Panel: Brand ── */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-14 overflow-hidden border-r border-border">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-cyan-500/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Top: Logo + back */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-12 group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </Link>
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <span className="text-xl font-bold font-display text-foreground">
              Skill<span className="text-primary">Verse</span>
            </span>
          </Link>
        </motion.div>

        {/* Middle: Headline */}
        <motion.div variants={fadeUp} custom={0.15} initial="hidden" animate="visible" className="relative z-10">
          <h2 className="font-display text-4xl font-bold text-foreground mb-4 leading-tight">
            Welcome back to your<br />
            <span className="text-gradient-cobalt">learning journey.</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10">
            Pick up right where you left off. New challenges and points await.
          </p>
          <ul className="space-y-3">
            {highlights.map((h, i) => (
              <motion.li
                key={i}
                variants={fadeUp}
                custom={0.25 + i * 0.07}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                  {h.icon}
                </div>
                {h.text}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Bottom: Testimonial card */}
        <motion.div
          variants={fadeUp}
          custom={0.5}
          initial="hidden"
          animate="visible"
          className="relative z-10 card-base rounded-2xl p-5 shadow-md"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              KT
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Advanced React Patterns</p>
              <p className="text-xs text-primary">New module unlocked · 150 pts earned</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            "SkillVerse changed how I approach learning. The points system kept me motivated every single day."
          </p>
          <div className="flex gap-0.5 mt-3">
            {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
          </div>
        </motion.div>
      </div>

      {/* ── Right Panel: Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold font-display text-foreground">Skill<span className="text-primary">Verse</span></span>
          </div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Sign in</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:underline">Create one free</Link>
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm"
            >
              <div className="w-4 h-4 rounded-full border border-destructive/40 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">!</div>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-foreground mb-2 block">
                Email address
              </Label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className="input-styled w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <span className="text-xs text-primary cursor-pointer hover:underline">Forgot password?</span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input-styled w-full pr-10"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.01, y: -1 } : {}}
              whileTap={!loading ? { scale: 0.99 } : {}}
              className="btn-primary w-full !py-3 text-base !rounded-xl mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </motion.button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            By signing in, you agree to our{' '}
            <span className="text-foreground/70 cursor-pointer hover:text-primary transition-colors">Terms</span>
            {' '}and{' '}
            <span className="text-foreground/70 cursor-pointer hover:text-primary transition-colors">Privacy Policy</span>.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
