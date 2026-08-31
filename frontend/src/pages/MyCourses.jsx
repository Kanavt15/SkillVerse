import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen, Play, Star, Loader2, GraduationCap,
  CheckCircle2, Clock, Award, ArrowRight, Filter
} from 'lucide-react';
import CertificateCard from '../components/CertificateCard';

const SkeletonCard = () => (
  <div className="card-base rounded-2xl overflow-hidden">
    <div className="aspect-video skeleton" />
    <div className="p-5 space-y-3">
      <div className="h-4 w-1/3 skeleton rounded-full" />
      <div className="h-5 w-4/5 skeleton rounded-lg" />
      <div className="h-4 w-full skeleton rounded-lg" />
      <div className="h-2 w-full skeleton rounded-full mt-4" />
      <div className="h-9 w-full skeleton rounded-xl mt-2" />
    </div>
  </div>
);

const MyCourses = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [certificates, setCertificates] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

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

  const getStatus = (enrollment) => {
    const progress = Number(enrollment.progress_percentage) || 0;
    if (progress >= 100 || !!enrollment.completed_at) return 'completed';
    if (progress > 0) return 'in-progress';
    return 'not-started';
  };

  const tabs = [
    { key: 'all', label: 'All courses' },
    { key: 'in-progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'not-started', label: 'Not started' },
  ];

  const filtered = activeTab === 'all'
    ? enrollments
    : enrollments.filter(e => getStatus(e) === activeTab);

  const completedCount = enrollments.filter(e => getStatus(e) === 'completed').length;
  const inProgressCount = enrollments.filter(e => getStatus(e) === 'in-progress').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="h-10 w-48 skeleton rounded-xl mb-2" />
          <div className="h-5 w-64 skeleton rounded-full mb-10" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-3xl md:text-4xl font-bold text-foreground mb-1"
            >
              My Learning
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-muted-foreground text-sm"
            >
              {enrollments.length} enrolled · {completedCount} completed · {inProgressCount} in progress
            </motion.p>
          </div>
          <Link to="/courses">
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="btn-outline text-sm flex items-center gap-2 shrink-0"
            >
              <BookOpen className="h-4 w-4" />
              Browse more courses
            </motion.button>
          </Link>
        </div>

        {/* ── Stats strip ── */}
        {enrollments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="grid grid-cols-3 gap-3 mb-8"
          >
            {[
              { val: enrollments.length, label: 'Enrolled', icon: <BookOpen className="h-4 w-4 text-primary" /> },
              { val: inProgressCount, label: 'In progress', icon: <Clock className="h-4 w-4 text-amber-500" /> },
              { val: completedCount, label: 'Completed', icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
            ].map((s, i) => (
              <div key={i} className="card-base rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted shrink-0">{s.icon}</div>
                <div>
                  <div className="font-display text-2xl font-bold text-foreground">{s.val}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {enrollments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center card-base rounded-3xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5 border border-border">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No courses enrolled yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Browse our catalog and start your learning journey today!
            </p>
            <Link to="/courses">
              <button className="btn-primary flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Browse courses
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </motion.div>
        ) : (
          <>
            {/* ── Filter Tabs ── */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {tabs.map(tab => {
                const count = tab.key === 'all' ? enrollments.length
                  : enrollments.filter(e => getStatus(e) === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
                      activeTab === tab.key
                        ? 'bg-primary text-primary-foreground border-primary shadow-teal'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key ? 'bg-white/20' : 'bg-muted'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Course Grid ── */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Filter className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No courses in this category</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((enrollment, i) => {
                  const progress = Number(enrollment.progress_percentage) || 0;
                  const status = getStatus(enrollment);
                  const isCompleted = status === 'completed';
                  const totalLessons = Number(enrollment.total_lessons) || 0;
                  const completedLessons = Number(enrollment.completed_lessons) || 0;

                  return (
                    <motion.div
                      key={enrollment.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link to={`/courses/${enrollment.course_id}/learn`} className="group block h-full">
                        <div className="h-full flex flex-col card-base rounded-2xl overflow-hidden card-hover">
                          {/* Thumbnail */}
                          <div className="aspect-video relative overflow-hidden bg-muted">
                            {enrollment.thumbnail ? (
                              <img
                                src={getThumbnailUrl(enrollment.thumbnail)}
                                alt={enrollment.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                              </div>
                            )}
                            {/* Status badge */}
                            <div className="absolute top-3 right-3">
                              {isCompleted ? (
                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold shadow">
                                  <CheckCircle2 className="h-3 w-3" /> Completed
                                </span>
                              ) : status === 'in-progress' ? (
                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/90 backdrop-blur-sm border border-border text-foreground text-xs font-semibold shadow">
                                  <Play className="h-3 w-3 text-primary" /> {Math.round(progress)}%
                                </span>
                              ) : null}
                            </div>
                            {/* Progress bar at bottom of image */}
                            {!isCompleted && progress > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                                <div className="h-full progress-bar" style={{ width: `${progress}%` }} />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-5 flex-1 flex flex-col">
                            {enrollment.difficulty_level && (
                              <div className="mb-3">
                                <span className="badge-teal text-xs">{enrollment.difficulty_level}</span>
                              </div>
                            )}
                            <h3 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                              {enrollment.title}
                            </h3>
                            {enrollment.instructor_name && (
                              <p className="text-xs text-muted-foreground mb-4">by {enrollment.instructor_name}</p>
                            )}

                            {/* Progress */}
                            <div className="mt-auto">
                              <div className="flex justify-between text-xs mb-2">
                                <span className="text-muted-foreground">
                                  {completedLessons}/{totalLessons} lessons
                                </span>
                                <span className={`font-bold ${isCompleted ? 'text-emerald-500' : 'text-primary'}`}>
                                  {Math.round(progress)}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'progress-bar'}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
                                />
                              </div>
                            </div>

                            {/* Points */}
                            {isCompleted && enrollment.points_reward > 0 && (
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-2">
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                +{enrollment.points_reward} pts earned
                              </div>
                            )}

                            {/* Certificate */}
                            {isCompleted && certificates[enrollment.course_id] && (
                              <div className="mt-2" onClick={(e) => e.preventDefault()}>
                                <CertificateCard certificate={certificates[enrollment.course_id]} compact />
                              </div>
                            )}

                            {/* CTA */}
                            <button className={`w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              isCompleted
                                ? 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                                : 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15'
                            }`}>
                              <Play className="h-3.5 w-3.5" />
                              {isCompleted ? 'Review course' : status === 'not-started' ? 'Start learning' : 'Continue learning'}
                            </button>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyCourses;
