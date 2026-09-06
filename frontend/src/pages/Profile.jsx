import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  User, Mail, Star, Trophy, BookOpen, Clock, Edit3, Save, X,
  ArrowUpRight, ArrowDownRight, Gift, Loader2, GraduationCap, Shield,
  CheckCircle2, TrendingUp
} from 'lucide-react';

const Profile = () => {
  const { user, updateUser, refreshPoints } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', bio: '' });

  const fetchProfile = useCallback(async () => {
    try {
      const [profileRes, transRes, enrollRes] = await Promise.all([
        api.get('/auth/profile'),
        api.get('/points/transactions?limit=10'),
        api.get('/enrollments')
      ]);
      setProfile(profileRes.data.user);
      setTransactions(transRes.data.transactions || []);
      setEnrollments(enrollRes.data.enrollments || []);
      setEditForm({
        full_name: profileRes.data.user.full_name || '',
        bio: profileRes.data.user.bio || ''
      });
      if (profileRes.data.user.points !== undefined) refreshPoints();
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', editForm);
      setProfile(prev => ({ ...prev, ...res.data.user }));
      if (updateUser) updateUser(res.data.user);
      setEditing(false);
      toast.success('Saved', 'Profile updated successfully');
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const roleConfig = {
    learner: { label: 'Learner', cls: 'bg-primary/10 text-primary border-primary/20', Icon: GraduationCap },
    instructor: { label: 'Instructor', cls: 'bg-primary/10 text-primary border-primary/20', Icon: Shield },
    both: { label: 'Learner & Instructor', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20', Icon: Star },
  };

  const txIcon = (type) => ({
    earned: <ArrowUpRight className="h-4 w-4 text-emerald-500" />,
    spent: <ArrowDownRight className="h-4 w-4 text-destructive" />,
    bonus: <Gift className="h-4 w-4 text-amber-500" />,
  }[type] || <Star className="h-4 w-4 text-muted-foreground" />);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background pt-16 flex items-center justify-center text-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  const completedCount = enrollments.filter(e => Number(e.progress_percentage) >= 100).length;
  const inProgressCount = enrollments.filter(e => {
    const p = Number(e.progress_percentage);
    return p > 0 && p < 100;
  }).length;
  const role = roleConfig[profile.role] || roleConfig.learner;

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Top: Profile card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-base rounded-3xl overflow-hidden mb-6 shadow-md"
        >
          {/* Banner */}
          <div className="h-28 bg-gradient-to-r from-primary via-blue-600 to-cyan-500 relative">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            />
          </div>

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl border-4 border-card bg-primary flex items-center justify-center text-white text-3xl font-black shadow-lg shrink-0">
                {profile.full_name?.charAt(0)?.toUpperCase() || <User className="h-10 w-10" />}
              </div>

              <div className="flex-1 min-w-0 sm:pb-1 mt-2 sm:mt-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="font-display text-2xl font-bold text-foreground">{profile.full_name}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${role.cls}`}>
                    <role.Icon className="h-3 w-3" />
                    {role.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="text-sm">{profile.email}</span>
                </div>
                {!editing && profile.bio && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg">{profile.bio}</p>
                )}
              </div>

              {/* Edit button */}
              <button
                onClick={() => setEditing(!editing)}
                className={`shrink-0 flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-all ${
                  editing ? 'border-border text-muted-foreground hover:text-foreground hover:bg-muted' : 'btn-secondary'
                }`}
              >
                {editing ? <><X className="h-4 w-4" /> Cancel</> : <><Edit3 className="h-4 w-4" /> Edit profile</>}
              </button>
            </div>

            {/* Edit form */}
            <AnimatePresence>
              {editing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 p-5 bg-muted/50 rounded-2xl border border-border space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Full name</label>
                      <input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                        className="input-styled w-full max-w-sm"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm(p => ({ ...p, bio: e.target.value }))}
                        className="input-styled w-full resize-none"
                        placeholder="Tell us about yourself…"
                        rows={3}
                      />
                    </div>
                    <button onClick={handleSave} disabled={saving} className="btn-primary text-sm gap-2 disabled:opacity-60">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Stats row ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          {[
            { val: (profile.points || 0).toLocaleString(), label: 'Points', icon: <Star className="h-5 w-5 text-amber-500 fill-amber-500" />, sub: 'balance' },
            { val: enrollments.length, label: 'Courses', icon: <BookOpen className="h-5 w-5 text-primary" />, sub: 'enrolled' },
            { val: completedCount, label: 'Completed', icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, sub: 'finished' },
            { val: inProgressCount, label: 'In Progress', icon: <TrendingUp className="h-5 w-5 text-cyan-500" />, sub: 'ongoing' },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="stat-card rounded-2xl"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-muted">{s.icon}</div>
              </div>
              <div className="font-display text-2xl font-bold text-foreground">{s.val}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Bottom two columns ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Points transactions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-base rounded-2xl p-6"
          >
            <h2 className="font-display text-lg font-bold text-foreground mb-5 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              Points history
            </h2>

            {transactions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Star className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, i) => (
                  <motion.div
                    key={tx.id || i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      {txIcon(tx.transaction_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description || tx.transaction_type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${
                      tx.transaction_type === 'spent' ? 'text-destructive' : 'text-emerald-500'
                    }`}>
                      {tx.transaction_type === 'spent' ? '-' : '+'}{tx.amount}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent enrollments */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card-base rounded-2xl p-6"
          >
            <h2 className="font-display text-lg font-bold text-foreground mb-5 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Recent courses
            </h2>

            {enrollments.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <GraduationCap className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No courses enrolled yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.slice(0, 5).map((enr, i) => {
                  const progress = Math.round(Number(enr.progress_percentage) || 0);
                  const isCompleted = progress >= 100 || !!enr.completed_at;
                  return (
                    <motion.div
                      key={enr.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCompleted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{enr.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'progress-bar'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{progress}%</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
