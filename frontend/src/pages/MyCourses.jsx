import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Play, Star, Trophy, Loader2, GraduationCap } from 'lucide-react';
import { Button } from '../components/ui/button';

const MyCourses = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/enrollments');
      setEnrollments(response.data.enrollments || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getThumbnailUrl = (thumbnail) => {
    if (!thumbnail) return null;
    if (thumbnail.startsWith('http')) return thumbnail;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${baseUrl}${thumbnail}`;
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-emerald-100 text-emerald-700';
      case 'intermediate': return 'bg-amber-100 text-amber-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Courses</h1>
        <p className="text-gray-600">Track your learning progress</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-20">
          <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-500 mb-2">No courses yet</h3>
          <p className="text-gray-400 mb-6">Browse our catalog and start learning!</p>
          <Link to="/courses">
            <Button>
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Courses
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map(enrollment => {
            const isCompleted = enrollment.progress_percentage === 100 || enrollment.completed_at;
            const totalLessons = enrollment.total_lessons || 0;
            const completedLessons = enrollment.completed_lessons || 0;

            return (
              <Link key={enrollment.id} to={`/courses/${enrollment.course_id}/learn`} className="group">
                <div className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  <div className="aspect-video bg-gray-100 overflow-hidden relative">
                    {enrollment.thumbnail ? (
                      <img
                        src={getThumbnailUrl(enrollment.thumbnail)}
                        alt={enrollment.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                        <BookOpen className="h-12 w-12 text-blue-300" />
                      </div>
                    )}
                    {/* Completed badge overlay */}
                    {isCompleted && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        <Trophy className="h-3.5 w-3.5" />
                        Completed
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getDifficultyColor(enrollment.difficulty_level)}`}>
                        {enrollment.difficulty_level}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {enrollment.title}
                    </h3>

                    {/* Progress Bar */}
                    <div className="mt-auto pt-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-500">
                          {completedLessons}/{totalLessons} lessons
                        </span>
                        <span className={`font-bold ${isCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                          {Math.round(enrollment.progress_percentage || 0)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                          style={{ width: `${enrollment.progress_percentage || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Points Earned Badge */}
                    {isCompleted && enrollment.points_reward > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span>+{enrollment.points_reward} pts earned</span>
                      </div>
                    )}

                    {/* Continue Button */}
                    <Button variant={isCompleted ? "outline" : "default"} className="w-full mt-3" size="sm">
                      <Play className="h-4 w-4 mr-2" />
                      {isCompleted ? 'Review Course' : 'Continue Learning'}
                    </Button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyCourses;
