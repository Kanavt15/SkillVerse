import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';
import {
  BookOpen, Clock, Star, Users, Trophy,
  CheckCircle, Play, Lock, ArrowLeft, Loader2, AlertCircle
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

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [courseRes, lessonsRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/lessons/course/${id}`)
      ]);
      setCourse(courseRes.data.course);
      setLessons(lessonsRes.data.lessons || []);

      // Check enrollment status
      if (isAuthenticated) {
        try {
          const enrollRes = await api.get(`/enrollments/course/${id}`);
          setIsEnrolled(enrollRes.data.success);
        } catch {
          setIsEnrolled(false);
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
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const pointsCost = course.points_cost ?? 0;
    if (pointsCost > 0 && points < pointsCost) {
      showToast(`Not enough points! You need ${pointsCost} pts but have ${points} pts.`, 'error');
      return;
    }

    try {
      setEnrolling(true);
      const response = await api.post('/enrollments', { course_id: parseInt(id) });

      // Update points immediately for instant feedback
      if (response.data.points_balance !== undefined) {
        updatePoints(response.data.points_balance);
      }

      // Show point subtraction feedback
      if (pointsCost > 0) {
        showToast(`Enrolled! −${pointsCost} pts deducted (Balance: ${response.data.points_balance} pts)`, 'success');
      } else {
        showToast(response.data.message || 'Successfully enrolled in free course!', 'success');
      }

      setIsEnrolled(true);

      // Refresh points from server to keep everything in sync
      await refreshPoints();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to enroll';
      showToast(msg, 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-emerald-500/10 text-emerald-400';
      case 'intermediate': return 'bg-amber-500/10 text-amber-400';
      case 'advanced': return 'bg-red-500/10 text-red-400';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getThumbnailUrl = (thumbnail) => {
    if (!thumbnail) return null;
    if (thumbnail.startsWith('http')) return thumbnail;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${baseUrl}${thumbnail}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-slate-400">Course not found</h2>
      </div>
    );
  }

  const pointsCost = course.points_cost ?? 0;
  const pointsReward = course.points_reward ?? 0;
  const hasEnoughPoints = points >= pointsCost;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/courses" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Courses
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thumbnail */}
          <div className="aspect-video bg-white/[0.03] rounded-xl overflow-hidden">
            {course.thumbnail ? (
              <img
                src={getThumbnailUrl(course.thumbnail)}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-900/20 to-indigo-900/20">
                <BookOpen className="h-16 w-16 text-cyan-700" />
              </div>
            )}
          </div>

          {/* Course Info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${getDifficultyColor(course.difficulty_level)}`}>
                {course.difficulty_level}
              </span>
              {course.category_name && (
                <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400">
                  {course.category_name}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">{course.title}</h1>
            <p className="text-slate-400 leading-relaxed">{course.description}</p>
          </div>

          {/* Instructor */}
          <div className="bg-white/[0.04] rounded-xl p-4 flex items-center gap-3 border border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <span className="text-cyan-400 font-bold">
                {course.instructor_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Instructor</p>
              <p className="font-semibold text-white">{course.instructor_name}</p>
            </div>
          </div>

          {/* Lesson List */}
          <div>
            <h2 className="text-xl font-bold mb-4">
              Lessons ({lessons.length})
            </h2>
            {lessons.length === 0 ? (
              <p className="text-slate-500 py-4">No lessons available yet.</p>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson, index) => (
                  <div key={lesson.id} className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                      {lesson.is_free || isEnrolled ? (
                        <Play className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-white">{lesson.title}</p>
                      {lesson.duration_minutes && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {lesson.duration_minutes} min
                        </p>
                      )}
                    </div>
                    {lesson.is_free && !isEnrolled && (
                      <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Free</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Enrollment Card */}
        <div className="lg:col-span-1">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6 sticky top-24 space-y-5">
            {/* Points Cost */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                <span className="text-3xl font-bold text-white">
                  {pointsCost === 0 ? 'Free' : pointsCost}
                </span>
                {pointsCost > 0 && <span className="text-lg text-slate-400">points</span>}
              </div>
              {pointsReward > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-green-400 bg-green-500/10 rounded-lg py-2">
                  <Trophy className="h-4 w-4" />
                  <span>Earn <strong>{pointsReward}</strong> pts on completion</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/[0.04] rounded-lg p-3 text-center border border-white/[0.06]">
                <BookOpen className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                <p className="font-medium text-white">{lessons.length}</p>
                <p className="text-slate-500 text-xs">Lessons</p>
              </div>
              <div className="bg-white/[0.04] rounded-lg p-3 text-center border border-white/[0.06]">
                <Users className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                <p className="font-medium text-white">{course.enrollment_count || 0}</p>
                <p className="text-slate-500 text-xs">Enrolled</p>
              </div>
            </div>

            {/* Enrollment Button */}
            {isEnrolled ? (
              <Button
                onClick={() => navigate(`/courses/${id}/learn`)}
                className="w-full py-6 text-lg rounded-xl"
              >
                <Play className="h-5 w-5 mr-2" />
                Continue Learning
              </Button>
            ) : (
              <div className="space-y-3">
                {!hasEnoughPoints && pointsCost > 0 && isAuthenticated && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg text-sm text-red-400 border border-red-500/20">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>You need {pointsCost - points} more points. Complete courses to earn more!</span>
                  </div>
                )}
                <Button
                  onClick={handleEnroll}
                  disabled={enrolling || (!hasEnoughPoints && pointsCost > 0 && isAuthenticated)}
                  className="w-full py-6 text-lg rounded-xl"
                >
                  {enrolling ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Star className="h-5 w-5 mr-2" />
                  )}
                  {!isAuthenticated
                    ? 'Login to Enroll'
                    : pointsCost === 0
                      ? 'Enroll for Free'
                      : `Enroll for ${pointsCost} pts`}
                </Button>
                {isAuthenticated && pointsCost > 0 && (
                  <p className="text-xs text-center text-slate-500">
                    Your balance: {points.toLocaleString()} points
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
