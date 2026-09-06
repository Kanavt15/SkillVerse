import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Label } from '../components/ui/label';
import {
  Star, GraduationCap, Zap, Loader2, Eye, EyeOff,
  BookOpen, ArrowLeft, Trophy, CheckCircle2, Sparkles
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: d, ease: [0.16, 1, 0.3, 1] } }),
};

const Register = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'learner',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...data } = formData;
      await register(data);
      toast.success('Welcome to SkillVerse!', 'Account created successfully');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const roleOptions = [
    {
      value: 'learner',
      label: 'Learner',
      desc: 'Explore and enroll in courses',
      icon: <GraduationCap className="h-5 w-5" />,
    },
    {
      value: 'instructor',
      label: 'Instructor',
      desc: 'Create and sell your courses',
      icon: <Zap className="h-5 w-5" />,
    },
    {
      value: 'both',
      label: 'Both',
      desc: 'Learn and teach simultaneously',
      icon: <Star className="h-5 w-5" />,
    },
  ];

  const perks = [
    '500 free points on sign-up',
    'Access to beginner courses instantly',
    'Earn certificates upon completion',
    'Join a global learning community',
  ];

  return (
    <div className="min-h-screen flex flex-row-reverse bg-background">

      {/* ── Right Panel: Brand ── */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-14 overflow-hidden border-l border-border">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/8 via-background to-cyan-500/5 pointer-events-none" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-12 group transition-colors">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </Link>
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold font-display text-foreground">
              Skill<span className="text-primary">Verse</span>
            </span>
          </Link>
        </motion.div>

        {/* Middle */}
        <motion.div variants={fadeUp} custom={0.1} initial="hidden" animate="visible" className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Limited time — 500 bonus points
          </div>
          <h2 className="font-display text-4xl font-bold text-foreground mb-4 leading-tight">
            Start your learning<br />
            <span className="text-gradient-cobalt">adventure today.</span>
          </h2>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Join 2M+ learners building real skills. Free to start, rewarding to grow.
          </p>
          <ul className="space-y-3">
            {perks.map((perk, i) => (
              <motion.li
                key={i}
                variants={fadeUp}
                custom={0.2 + i * 0.06}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {perk}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Bottom: stat strip */}
        <motion.div
          variants={fadeUp}
          custom={0.5}
          initial="hidden"
          animate="visible"
          className="relative z-10 grid grid-cols-3 gap-3"
        >
          {[
            { val: '2M+', label: 'Learners' },
            { val: '5K+', label: 'Courses' },
            { val: '98%', label: 'Success rate' },
          ].map((s, i) => (
            <div key={i} className="card-base rounded-2xl p-4 text-center">
              <div className="font-display text-2xl font-black text-foreground">{s.val}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Left Panel: Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
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

          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Already have one?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm"
            >
              <div className="w-4 h-4 rounded-full border border-destructive/40 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">!</div>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-2.5 block">I want to…</Label>
              <div className="grid grid-cols-3 gap-2.5">
                {roleOptions.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: r.value })}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
                      formData.role === r.value
                        ? 'border-primary bg-primary/8 text-primary shadow-cobalt'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                    }`}
                  >
                    <span className="opacity-80">{r.icon}</span>
                    <span className="font-semibold text-xs">{r.label}</span>
                  </button>
                ))}
              </div>
              {formData.role && (
                <p className="text-xs text-muted-foreground mt-2">
                  {roleOptions.find(r => r.value === formData.role)?.desc}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="full_name" className="text-sm font-medium text-foreground mb-2 block">Full name</Label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="input-styled w-full"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-foreground mb-2 block">Email address</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-foreground mb-2 block">Password</Label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input-styled w-full pr-9"
                    placeholder="Min. 6 chars"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground mb-2 block">Confirm</Label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`input-styled w-full pr-9 ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-destructive/60'
                        : formData.confirmPassword && formData.password === formData.confirmPassword
                        ? 'border-emerald-500/60'
                        : ''
                    }`}
                    placeholder="Repeat"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.01, y: -1 } : {}}
              whileTap={!loading ? { scale: 0.99 } : {}}
              className="btn-primary w-full !py-3 text-base !rounded-xl disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create account — it's free
                </span>
              )}
            </motion.button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By registering, you agree to our{' '}
            <span className="text-foreground/70 cursor-pointer hover:text-primary transition-colors">Terms</span>
            {' '}and{' '}
            <span className="text-foreground/70 cursor-pointer hover:text-primary transition-colors">Privacy Policy</span>.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
