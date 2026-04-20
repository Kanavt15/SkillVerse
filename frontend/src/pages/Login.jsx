import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Label } from '../components/ui/label';
import { BookOpen, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';

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

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* ── Left Side: Brand Visuals ── */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 z-0">
           <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-violet-900/40 via-background to-background animate-pulse-slow object-cover opacity-80" />
           <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-violet-600/30 rounded-full mix-blend-screen filter blur-[80px] animate-blob" />
           <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-fuchsia-600/20 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-2000" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 animate-fade-in-left" style={{ animationFillMode: 'both', animationDelay: '0.2s' }}>
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Skill<span className="text-gradient">Verse</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 mb-20 animate-fade-in-left" style={{ animationFillMode: 'both', animationDelay: '0.4s' }}>
          <h2 className="text-5xl font-black text-white mb-6 leading-tight">
            Welcome back to the <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Frontier of Learning.</span>
          </h2>
          <p className="text-xl text-[hsl(var(--muted-foreground))] font-light max-w-md">
            Pick up right where you left off. New challenges and rewards await.
          </p>
        </div>
        
        {/* Floating Testimonial/Stat */}
        <div className="relative z-10 glass p-6 rounded-2xl max-w-md border border-white/10 shadow-2xl backdrop-blur-xl group animate-fade-in-left" style={{ animationFillMode: 'both', animationDelay: '0.6s' }}>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
               <span className="text-violet-300 font-bold text-sm">JS</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Advanced React Patterns</p>
              <p className="text-xs text-violet-300">New Module Unlocked</p>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mb-1 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full w-[75%]" />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-right">You are 75% complete</p>
        </div>
      </div>

      {/* ── Right Side: Auth Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-background lg:hidden z-0" />
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] lg:hidden z-0 pointer-events-none" />

        <div className="w-full max-w-sm relative z-10 animate-fade-in-up" style={{ animationFillMode: 'both', animationDelay: '0.3s' }}>
          <div className="text-center lg:text-left mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Sign In</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-sm">Enter your credentials to access your account</p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Email Address</Label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm bg-black/20 border border-white/10 text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Password</Label>
                  {/* Forgot Password could go here */}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm bg-black/20 border border-white/10 text-white placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group inline-flex items-center justify-center px-6 py-3.5 font-bold text-white transition-all duration-300 bg-violet-600 rounded-xl hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 overflow-hidden mt-4 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(124,92,233,0.3)] glow-violet"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Authenticating...</>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Don't have an account?{' '}
            <Link to="/register" className="text-white font-medium hover:text-violet-400 transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-violet-400">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
