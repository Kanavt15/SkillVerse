import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Play, Star, Trophy, Loader2, GraduationCap, Award, CheckCircle2 } from 'lucide-react';
import CertificateCard from '../components/CertificateCard';

const MyCourses = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [certificates, setCertificates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEnrollments(); }, []);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const [enrollRes, certRes] = await Promise.all([
        api.get('/enrollments'),
        api.get('/certificates'),
      ]);
      setEnrollments(enrollRes.data.enrollments || []);
      const certMap = {};
      (certRes.data.certificates || []).forEach(cert => { certMap[cert.course_id] = cert; });
      setCertificates(certMap);
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

  const getDifficultyBadge = (level) => {
    const map = { beginner: 'badge-emerald', intermediate: 'badge-gold', advanced: 'badge-red' };
    return map[level] || 'badge-violet';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-400 mx-auto mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading your courses...</p>
        </div>
      </div>
    );
  }

  const completedCount = enrollments.filter(e => {
    const progress = Number(e.progress_percentage) || 0;
    return progress >= 100 || !!e.completed_at;
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-1">My Learning</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm">
          {enrollments.length} enrolled · {completedCount} completed
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="glass-card rounded-2xl py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No courses enrolled yet</h3>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6">Browse our catalog and start learning today!</p>
          <Link to="/courses">
            <button className="btn-primary flex items-center gap-2 mx-auto">
              <BookOpen className="h-4 w-4" />
              Browse Courses
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrollments.map(enrollment => {
            const progress = Number(enrollment.progress_percentage) || 0;
            const isCompleted = progress >= 100 || !!enrollment.completed_at;
            const totalLessons = Number(enrollment.total_lessons) || 0;
            const completedLessons = Number(enrollment.completed_lessons) || 0;

            return (
              <Link key={enrollment.id} to={`/courses/${enrollment.course_id}/learn`} className="group">
                <div className="h-full flex flex-col rounded-2xl border border-white/6 bg-white/[0.025] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/25 hover:shadow-xl hover:shadow-black/30">
                  {/* Thumbnail */}
                  <div className="aspect-video overflow-hidden relative bg-gradient-to-br from-violet-900/30 to-indigo-900/20">
                    {enrollment.thumbnail ? (
                      <img
                        src={getThumbnailUrl(enrollment.thumbnail)}
                        alt={enrollment.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-violet-500/30" />
                      </div>
                    )}
                    {/* Completed overlay */}
                    {isCompleted && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </div>
                    )}
                    {/* Progress overlay when in-progress */}
                    {!isCompleted && progress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                        <div
                          className="h-full progress-bar transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      <span className={getDifficultyBadge(enrollment.difficulty_level)}>
                        {enrollment.difficulty_level}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 group-hover:text-violet-300 transition-colors line-clamp-2 leading-snug">
                      {enrollment.title}
                    </h3>

                    {/* Progress */}
                    <div className="mt-auto pt-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {completedLessons}/{totalLessons} lessons
                        </span>
                        <span className={`font-bold ${isCompleted ? 'text-emerald-400' : 'text-violet-400'}`}>
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/6 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'progress-bar'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Points earned */}
                    {isCompleted && enrollment.points_reward > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium">+{enrollment.points_reward} pts earned</span>
                      </div>
                    )}

                    {/* Certificate */}
                    {isCompleted && certificates[enrollment.course_id] && (
                      <div className="mt-2" onClick={(e) => e.preventDefault()}>
                        <CertificateCard certificate={certificates[enrollment.course_id]} compact />
                      </div>
                    )}

                    {/* CTA Button */}
                    <button
                      className={`w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        isCompleted
                          ? 'border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-white/20'
                          : 'bg-violet-500/15 border border-violet-500/25 text-violet-300 group-hover:bg-violet-500/25'
                      }`}
                    >
                      <Play className="h-4 w-4" />
                      {isCompleted ? 'Review Course' : 'Continue Learning'}
                    </button>
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
