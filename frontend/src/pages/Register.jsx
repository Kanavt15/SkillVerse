import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Star } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'learner'
  });
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
      const { confirmPassword, ...registrationData } = formData;
      await register(registrationData);
      toast.success('Welcome to SkillVerse!', 'Your account has been created successfully');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const inputClasses = "bg-card border border-border shadow-sm border-border text-foreground placeholder:text-muted-foreground text-opacity-60 focus:border-cyan-500/50 focus:ring-cyan-500/30";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Background effects removed for light theme cleanliness */}

      <Card className="w-full max-w-md bg-background/80 backdrop-blur-xl border-border shadow-2xl shadow-black/40 relative z-10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Star className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground text-opacity-80">
            Join SkillVerse and get <span className="text-amber-400 font-medium">500 free points</span> to start learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-muted-foreground">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className={inputClasses}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-muted-foreground">I want to</Label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${inputClasses}`}
              >
                <option value="learner" className="bg-background text-foreground">Learn Skills</option>
                <option value="instructor" className="bg-background text-foreground">Teach Skills</option>
                <option value="both" className="bg-background text-foreground">Both Learn & Teach</option>
              </select>
            </div>

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <div className="text-center text-sm text-muted-foreground text-opacity-80">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 hover:underline">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
