import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Label } from '../components/ui/label';
import { Star, GraduationCap, Zap, Loader2, Eye, EyeOff, BookOpen, ArrowLeft, Trophy } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'learner',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
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
    { value: 'learner', label: 'Learner', icon: <GraduationCap className="h-5 w-5" /> },
    { value: 'instructor', label: 'Instructor', icon: <Zap className="h-5 w-5" /> },
    { value: 'both', label: 'Both', icon: <Star className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-row-reverse bg-background relative overflow-hidden">
      {/* ── Right Side: Brand Visuals ── */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-12 overflow-hidden border-l border-white/5 bg-[#0a0c1a]">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
           <div className="absolute top-0 right-0 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-background to-background animate-pulse-slow object-cover opacity-80" />
           <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[80px] animate-blob" />
           <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/30 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-2000" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex justify-end animate-fade-in-right" style={{ animationFillMode: 'both', animationDelay: '0.2s' }}>
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-12">
            Back to Home <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </div>

        <div className="relative z-10 my-auto text-right flex flex-col items-end animate-fade-in-right" style={{ animationFillMode: 'both', animationDelay: '0.4s' }}>
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2 mb-6 backdrop-blur-md">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-bold text-amber-400">Join to claim 500 points</span>
          </div>
          
          <h2 className="text-5xl font-black text-white mb-6 leading-tight">
            Start Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-400 to-cyan-400">Next Chapter.</span>
          </h2>
          <p className="text-xl text-[hsl(var(--muted-foreground))] font-light max-w-sm text-right">
            Whether you're here to learn a new skill or teach others, SkillVerse is your launchpad.
          </p>
        </div>
        
        {/* Floating Stat card */}
        <div className="relative z-10 glass p-6 rounded-2xl w-full max-w-sm ml-auto border border-white/10 shadow-2xl backdrop-blur-xl animate-fade-in-right" style={{ animationFillMode: 'both', animationDelay: '0.6s' }}>
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
               <Trophy className="text-indigo-400 w-6 h-6" />
             </div>
             <div className="text-left">
               <p className="text-sm font-bold text-white">Top Rated Platform</p>
               <p className="text-xs text-indigo-300">Over 50M points distributed</p>
             </div>
           </div>
        </div>
      </div>

      {/* ── Left Side: Auth Form ── */}
      <div className="w-full lg:w-[55%] flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-background lg:hidden z-0" />
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] lg:hidden z-0 pointer-events-none" />

        <div className="w-full max-w-md relative z-10 animate-fade-in-up" style={{ animationFillMode: 'both', animationDelay: '0.3s' }}>
          {/* Logo on mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">SkillVerse</span>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-sm">Fill in the details below to get started</p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Full Name</Label>
                <input
                  id="full_name" name="full_name" type="text"
                  placeholder="Jane Doe"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm bg-black/20 border border-white/10 text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Email Address</Label>
                <input
                  id="email" name="email" type="email"
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm bg-black/20 border border-white/10 text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Password</Label>
                  <div className="relative">
                    <input
                      id="password" name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 chars"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="w-full rounded-xl px-4 py-3 text-sm bg-black/20 border border-white/10 text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Confirm</Label>
                  <input
                    id="confirmPassword" name="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm bg-black/20 border border-white/10 text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">I want to...</Label>
                <div className="flex gap-2">
                  {roleOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: opt.value })}
                      className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${
                        formData.role === opt.value
                          ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                          : 'border-white/10 bg-white/5 text-[hsl(var(--muted-foreground))] hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className={`mb-1 ${formData.role === opt.value ? 'text-indigo-400' : ''}`}>
                        {opt.icon}
                      </div>
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group inline-flex items-center justify-center px-6 py-3.5 font-bold text-white transition-all duration-300 bg-indigo-600 rounded-xl hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 overflow-hidden mt-6 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)] glow-cyan"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
                ) : 'Sign Up Final Step'}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Already have an account?{' '}
            <Link to="/login" className="text-white font-medium hover:text-indigo-400 transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-indigo-400">
              Sign in securely
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
