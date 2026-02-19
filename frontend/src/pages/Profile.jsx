import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
    User, Mail, Star, Trophy, BookOpen, Clock, Edit3, Save, X,
    ArrowUpRight, ArrowDownRight, Gift, Loader2, GraduationCap, Shield
} from 'lucide-react';

const Profile = () => {
    const { user, updateUser } = useAuth();
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
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

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

    const getRoleBadge = (role) => {
        const roleConfig = {
            learner: { label: 'Learner', color: 'bg-cyan-500/10 text-cyan-400', icon: GraduationCap },
            instructor: { label: 'Instructor', color: 'bg-purple-500/10 text-purple-400', icon: Shield },
            both: { label: 'Learner & Instructor', color: 'bg-indigo-500/10 text-indigo-400', icon: Star }
        };
        const config = roleConfig[role] || roleConfig.learner;
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                <Icon className="h-3.5 w-3.5" />
                {config.label}
            </span>
        );
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'earned': return <ArrowUpRight className="h-4 w-4 text-green-500" />;
            case 'spent': return <ArrowDownRight className="h-4 w-4 text-red-500" />;
            case 'bonus': return <Gift className="h-4 w-4 text-amber-500" />;
            default: return <Star className="h-4 w-4 text-slate-500" />;
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl font-semibold text-slate-400">Profile not found</h2>
            </div>
        );
    }

    const completedCourses = enrollments.filter(e => Number(e.progress_percentage) === 100).length;
    const inProgressCourses = enrollments.filter(e => Number(e.progress_percentage) < 100).length;

    return (
        <div className="min-h-screen py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Profile Header */}
                <div className="relative mb-8">
                    <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-t-2xl" />
                    <Card className="rounded-t-none border-t-0 -mt-px">
                        <CardContent className="pt-0 pb-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
                                {/* Avatar */}
                                <div className="h-24 w-24 rounded-full bg-slate-900 border-4 border-slate-800 shadow-lg flex items-center justify-center overflow-hidden shrink-0">
                                    {profile.profile_image ? (
                                        <img src={profile.profile_image} alt={profile.full_name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                            <span className="text-3xl font-bold text-white">
                                                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 sm:pb-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h1 className="text-2xl font-bold text-white">{profile.full_name}</h1>
                                        {getRoleBadge(profile.role)}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                                        <Mail className="h-4 w-4" />
                                        <span className="text-sm">{profile.email}</span>
                                    </div>
                                </div>
                                <Button
                                    variant={editing ? 'ghost' : 'outline'}
                                    size="sm"
                                    onClick={() => setEditing(!editing)}
                                    className="shrink-0"
                                >
                                    {editing ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Edit3 className="h-4 w-4 mr-1" /> Edit Profile</>}
                                </Button>
                            </div>

                            {/* Edit Form */}
                            {editing && (
                                <div className="mt-6 p-4 bg-white/[0.04] rounded-xl space-y-4 border border-white/[0.08]">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit_name">Full Name</Label>
                                        <Input
                                            id="edit_name"
                                            value={editForm.full_name}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit_bio">Bio</Label>
                                        <Textarea
                                            id="edit_bio"
                                            value={editForm.bio}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                                            placeholder="Tell us about yourself..."
                                            rows={3}
                                        />
                                    </div>
                                    <Button onClick={handleSave} disabled={saving} size="sm">
                                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            )}

                            {/* Bio */}
                            {!editing && profile.bio && (
                                <p className="mt-4 text-slate-400 text-sm leading-relaxed">{profile.bio}</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="text-center p-4">
                        <div className="flex items-center justify-center mb-2">
                            <div className="h-10 w-10 bg-amber-500/10 rounded-full flex items-center justify-center">
                                <Star className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white">{profile.points || 0}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Points Balance</div>
                    </Card>
                    <Card className="text-center p-4">
                        <div className="flex items-center justify-center mb-2">
                            <div className="h-10 w-10 bg-cyan-500/10 rounded-full flex items-center justify-center">
                                <BookOpen className="h-5 w-5 text-cyan-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white">{enrollments.length}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Enrolled Courses</div>
                    </Card>
                    <Card className="text-center p-4">
                        <div className="flex items-center justify-center mb-2">
                            <div className="h-10 w-10 bg-green-500/10 rounded-full flex items-center justify-center">
                                <Trophy className="h-5 w-5 text-green-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white">{completedCourses}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Completed</div>
                    </Card>
                    <Card className="text-center p-4">
                        <div className="flex items-center justify-center mb-2">
                            <div className="h-10 w-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                                <Clock className="h-5 w-5 text-purple-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-white">{inProgressCourses}</div>
                        <div className="text-xs text-slate-500 mt-0.5">In Progress</div>
                    </Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Points History */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Star className="h-5 w-5 text-amber-500" />
                                Points History
                            </CardTitle>
                            <CardDescription>Your recent point transactions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-6">No transactions yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map((t) => (
                                        <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/[0.06] last:border-0">
                                            <div className="h-8 w-8 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                                                {getTransactionIcon(t.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{t.description}</p>
                                                <p className="text-xs text-slate-500">{formatDate(t.created_at)}</p>
                                            </div>
                                            <span className={`text-sm font-semibold whitespace-nowrap ${t.type === 'earned' || t.type === 'bonus' ? 'text-green-600' : 'text-red-500'
                                                }`}>
                                                {t.type === 'spent' ? '-' : '+'}{t.amount} pts
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Enrolled Courses */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-blue-500" />
                                My Courses
                            </CardTitle>
                            <CardDescription>Your enrolled courses and progress</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {enrollments.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-slate-500 text-sm mb-3">No courses yet</p>
                                    <Button variant="outline" size="sm" onClick={() => navigate('/courses')}>
                                        Browse Courses
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {enrollments.slice(0, 6).map((enrollment) => {
                                        const progress = Number(enrollment.progress_percentage) || 0;
                                        const isComplete = progress === 100;
                                        return (
                                            <div
                                                key={enrollment.id}
                                                className="flex items-center gap-3 py-2 border-b border-white/[0.06] last:border-0 cursor-pointer hover:bg-white/[0.04] rounded -mx-2 px-2 transition-colors"
                                                onClick={() => navigate(`/courses/${enrollment.course_id}/learn`)}
                                            >
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isComplete ? 'bg-green-500/10' : 'bg-cyan-500/10'
                                                    }`}>
                                                    {isComplete
                                                        ? <Trophy className="h-4 w-4 text-green-400" />
                                                        : <BookOpen className="h-4 w-4 text-cyan-400" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{enrollment.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap">{progress}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {enrollments.length > 6 && (
                                        <Button variant="link" size="sm" onClick={() => navigate('/my-courses')} className="w-full">
                                            View all {enrollments.length} courses →
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Member Since */}
                <div className="text-center text-sm text-slate-500 mt-8 pb-4">
                    Member since {formatDate(profile.created_at)}
                </div>
            </div>
        </div>
    );
};

export default Profile;
