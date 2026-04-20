import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Label } from '../components/ui/label';
import { Star, GraduationCap, Zap, Loader2, Eye, EyeOff } from 'lucide-react';

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
    { value: 'learner', label: 'Learn Skills', icon: <GraduationCap className="h-5 w-5" />, desc: 'Access courses & track progress' },
    { value: 'instructor', label: 'Teach Skills', icon: <Zap className="h-5 w-5" />, desc: 'Create & sell your courses' },
    { value: 'both', label: 'Both', icon: <Star className="h-5 w-5" />, desc: 'Learn and teach simultaneously' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative py-8 pt-24">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-full px-4 py-1.5 mb-5">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm text-amber-300 font-medium">500 free points on signup</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Start your learning journey today</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Full Name</Label>
              <input
                id="full_name" name="full_name" type="text"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={handleChange}
                required
                className="input-styled"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Email</Label>
              <input
                id="email" name="email" type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-styled"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Password</Label>
              <div className="relative">
                <input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="input-styled pr-10"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Confirm Password</Label>
              <input
                id="confirmPassword" name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="input-styled"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">I want to...</Label>
              <div className="grid grid-cols-3 gap-2">
                {roleOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: opt.value })}
                    className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                      formData.role === opt.value
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                        : 'border-white/8 bg-white/3 text-[hsl(var(--muted-foreground))] hover:border-white/15 hover:bg-white/5'
                    }`}
                  >
                    <div className={`flex justify-center mb-1.5 ${formData.role === opt.value ? 'text-violet-400' : ''}`}>
                      {opt.icon}
                    </div>
                    <div className="text-xs font-semibold">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 !py-3 mt-2 glow-violet-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
              ) : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
