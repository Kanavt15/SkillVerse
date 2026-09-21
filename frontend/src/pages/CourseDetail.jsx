import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ReviewSection from '../components/ReviewSection';
import DiscussionSection from '../components/DiscussionSection';
import {
  BookOpen, Clock, Star, Users, Trophy,
  CheckCircle, Play, Lock, ArrowLeft, Loader2, AlertCircle,
  MessageSquare, UserPlus, UserMinus, Zap
} from 'lucide-react';

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, points, updatePoints, refreshPoints } = useAuth();
  const { showToast } = useToast();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => { fetchCourseData(); }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [courseRes, lessonsRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/lessons/course/${id}`),
      ]);
      setCourse(courseRes.data.course);
      setLessons(lessonsRes.data.lessons || []);
      if (isAuthenticated) {
        try {
          const enrollRes = await api.get(`/enrollments/course/${id}`);
          setIsEnrolled(enrollRes.data.success);
        } catch { setIsEnrolled(false); }
        if (courseRes.data.course?.instructor_id) {
          try {
            const followRes = await api.get(`/followers/${courseRes.data.course.instructor_id}/is-following`);
            setIsFollowing(followRes.data.isFollowing);
          } catch { setIsFollowing(false); }
        }
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      showToast('Error loading course', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const pointsCost = course.points_cost ?? 0;
    if (pointsCost > 0 && points < pointsCost) {
      showToast(`Not enough points! You need ${pointsCost} pts but have ${points} pts.`, 'error');
      return;
    }
    try {
      setEnrolling(true);
      // `id` is an ObjectId string; parseInt() produced NaN -> null in JSON.
      const response = await api.post('/enrollments', { course_id: id });
      if (response.data.points_balance !== undefined) updatePoints(response.data.points_balance);
      showToast(pointsCost > 0
        ? `Enrolled! −${pointsCost} pts deducted`
        : response.data.message || 'Enrolled in free course!', 'success');
      setIsEnrolled(true);
      await refreshPoints();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to enroll', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (user?.id === course?.instructor_id) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.delete(`/followers/${course.instructor_id}`);
        setIsFollowing(false);
        showToast('Unfollowed instructor', 'success');
      } else {
        await api.post(`/followers/${course.instructor_id}`);
        setIsFollowing(true);
        showToast("Following instructor! You'll be notified of new courses.", 'success');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error updating follow status', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const getDifficultyBadge = (level) => {
    const map = { beginner: 'badge-emerald', intermediate: 'badge-amber', advanced: 'badge-red' };
    return map[level] || 'badge-teal';
  };

  const getThumbnailUrl = (thumbnail) => {
    if (!thumbnail) return null;
    if (thumbnail.startsWith('http')) return thumbnail;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${baseUrl}${thumbnail}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <h2 className="text-xl font-semibold text-muted-foreground">Course not found</h2>
      </div>
    );
  }

  const pointsCost = course.points_cost ?? 0;
  const pointsReward = course.points_reward ?? 0;
  const hasEnoughPoints = points >= pointsCost;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Courses
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ── Main Content ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thumbnail */}
          <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-cyan-500/10 border border-border">
            {course.thumbnail ? (
              <img src={getThumbnailUrl(course.thumbnail)} alt={course.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-16 w-16 text-primary/30" />
              </div>
            )}
          </div>

          {/* Course Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={getDifficultyBadge(course.difficulty_level)}>{course.difficulty_level}</span>
              {course.category_name && <span className="badge-teal">{course.category_name}</span>}
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3 leading-snug">{course.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{course.description}</p>
          </div>

          {/* Instructor Card */}
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
                {course.instructor_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Instructor</p>
                <p className="font-semibold text-foreground text-sm">{course.instructor_name}</p>
              </div>
            </div>
            {isAuthenticated && user?.id !== course.instructor_id && (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                id="follow-instructor-btn"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  isFollowing
                    ? 'border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/25 hover:bg-red-500/8'
                    : 'bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25'
                }`}
              >
                {followLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFollowing ? (
                  <><UserMinus className="h-4 w-4" /> Unfollow</>
                ) : (
                  <><UserPlus className="h-4 w-4" /> Follow</>
                )}
              </button>
            )}
          </div>

          {/* Lessons */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">
              Course Content
              <span className="ml-2 text-sm font-normal text-muted-foreground">({lessons.length} lessons)</span>
            </h2>
            {lessons.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">No lessons available yet.</p>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson, index) => {
                  const isAccessible = lesson.is_free || isEnrolled;
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => isAccessible && navigate(`/courses/${id}/learn?lesson=${lesson.id}`)}
                      className={`flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 transition-all duration-200 ${
                        isAccessible
                          ? 'cursor-pointer hover:border-primary/25 hover:bg-primary/5'
                          : 'opacity-70'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isAccessible ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isAccessible ? <Play className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{lesson.title}</p>
                        {lesson.duration_minutes && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {lesson.duration_minutes} min
                          </p>
                        )}
                      </div>
                      {lesson.is_free && !isEnrolled && (
                        <span className="badge-emerald">Free</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ReviewSection courseId={id} instructorId={course.instructor_id} />
          <DiscussionSection courseId={id} instructorId={course.instructor_id} />
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 sticky top-24 space-y-5">
            {/* Price */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
                <span className="text-3xl font-black text-foreground">
                  {pointsCost === 0 ? 'Free' : pointsCost}
                </span>
                {pointsCost > 0 && <span className="text-sm text-muted-foreground">points</span>}
              </div>
              {pointsReward > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2 px-3 mt-2">
                  <Trophy className="h-4 w-4" />
                  <span>Earn <strong>{pointsReward}</strong> pts on completion</span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: <BookOpen className="h-4 w-4" />, value: lessons.length, label: 'Lessons' },
                { icon: <Users className="h-4 w-4" />, value: course.enrollment_count || 0, label: 'Enrolled' },
                { icon: <Star className="h-4 w-4 text-amber-400 fill-amber-400" />, value: parseFloat(course.avg_rating || 0).toFixed(1), label: 'Rating' },
                { icon: <MessageSquare className="h-4 w-4" />, value: course.review_count || 0, label: 'Reviews' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-muted/50 border border-border rounded-xl p-3 text-center">
                  <div className="flex justify-center mb-1.5 text-muted-foreground">{stat.icon}</div>
                  <p className="font-bold text-foreground text-sm">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Enroll / Continue */}
            {isEnrolled ? (
              <button
                onClick={() => navigate(`/courses/${id}/learn`)}
                className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5 text-base glow-cobalt"
              >
              <Play className="h-5 w-5" />
              Continue Learning
              </button>
            ) : (
              <div className="space-y-3">
                {!hasEnoughPoints && pointsCost > 0 && isAuthenticated && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>You need {pointsCost - points} more points. Complete courses to earn more!</span>
                  </div>
                )}
                <button
                  onClick={handleEnroll}
                  disabled={enrolling || (!hasEnoughPoints && pointsCost > 0 && isAuthenticated)}
                  className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5 text-base glow-cobalt disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrolling ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5" />
                  )}
                  {!isAuthenticated
                    ? 'Login to Enroll'
                    : pointsCost === 0
                      ? 'Enroll for Free'
                      : `Enroll — ${pointsCost} pts`}
                </button>
                {isAuthenticated && pointsCost > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Your balance: <strong className="text-foreground">{points?.toLocaleString()}</strong> points
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
