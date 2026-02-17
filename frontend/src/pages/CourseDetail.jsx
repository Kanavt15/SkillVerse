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

      if (response.data.points_balance !== undefined) {
        updatePoints(response.data.points_balance);
      }

      showToast(response.data.message || 'Successfully enrolled!', 'success');
      setIsEnrolled(true);
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to enroll';
      showToast(msg, 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-emerald-100 text-emerald-700';
      case 'intermediate': return 'bg-amber-100 text-amber-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-500">Course not found</h2>
      </div>
    );
  }

  const pointsCost = course.points_cost ?? 0;
  const pointsReward = course.points_reward ?? 0;
  const hasEnoughPoints = points >= pointsCost;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/courses" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Courses
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thumbnail */}
          <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
            {course.thumbnail ? (
              <img
                src={getThumbnailUrl(course.thumbnail)}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <BookOpen className="h-16 w-16 text-blue-300" />
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
                <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-600">
                  {course.category_name}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{course.title}</h1>
            <p className="text-gray-600 leading-relaxed">{course.description}</p>
          </div>

          {/* Instructor */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold">
                {course.instructor_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Instructor</p>
              <p className="font-semibold">{course.instructor_name}</p>
            </div>
          </div>

          {/* Lesson List */}
          <div>
            <h2 className="text-xl font-bold mb-4">
              Lessons ({lessons.length})
            </h2>
            {lessons.length === 0 ? (
              <p className="text-gray-500 py-4">No lessons available yet.</p>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson, index) => (
                  <div key={lesson.id} className="flex items-center gap-3 p-4 bg-white border rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      {lesson.is_free || isEnrolled ? (
                        <Play className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Lock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lesson.title}</p>
                      {lesson.duration_minutes && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {lesson.duration_minutes} min
                        </p>
                      )}
                    </div>
                    {lesson.is_free && !isEnrolled && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Free</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Enrollment Card */}
        <div className="lg:col-span-1">
          <div className="bg-white border rounded-xl p-6 shadow-sm sticky top-24 space-y-5">
            {/* Points Cost */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                <span className="text-3xl font-bold text-gray-900">
                  {pointsCost === 0 ? 'Free' : pointsCost}
                </span>
                {pointsCost > 0 && <span className="text-lg text-gray-500">points</span>}
              </div>
              {pointsReward > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-green-600 bg-green-50 rounded-lg py-2">
                  <Trophy className="h-4 w-4" />
                  <span>Earn <strong>{pointsReward}</strong> pts on completion</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <BookOpen className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                <p className="font-medium">{lessons.length}</p>
                <p className="text-gray-500 text-xs">Lessons</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                <p className="font-medium">{course.enrollment_count || 0}</p>
                <p className="text-gray-500 text-xs">Enrolled</p>
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
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
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
                  <p className="text-xs text-center text-gray-400">
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
