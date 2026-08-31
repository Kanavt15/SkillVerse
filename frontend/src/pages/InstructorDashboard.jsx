import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import {
  Plus, BookOpen, Users, Edit, Trash2, Eye, EyeOff,
  Loader2, BarChart3, TrendingUp, Zap, GraduationCap
} from 'lucide-react';

const SkeletonRow = () => (
  <div className="card-base rounded-2xl p-5 flex items-start gap-4">
    <div className="w-10 h-10 skeleton rounded-xl shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-5 w-2/3 skeleton rounded-lg" />
      <div className="h-4 w-full skeleton rounded-lg" />
      <div className="flex gap-4 mt-3">
        <div className="h-4 w-24 skeleton rounded-full" />
        <div className="h-4 w-20 skeleton rounded-full" />
      </div>
    </div>
    <div className="flex gap-2 shrink-0">
      <div className="w-9 h-9 skeleton rounded-xl" />
      <div className="w-24 h-9 skeleton rounded-xl" />
      <div className="w-9 h-9 skeleton rounded-xl" />
    </div>
  </div>
);

const InstructorDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchInstructorCourses(); }, []);

  const fetchInstructorCourses = async () => {
    try {
      const response = await api.get('/courses/instructor');
      setCourses(response.data.courses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course? This cannot be undone.')) return;
    try {
      await api.delete(`/courses/${courseId}`);
      setCourses(courses.filter(c => c.id !== courseId));
      toast.success('Deleted!', 'Course removed successfully');
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to delete course');
    }
  };

  const handleTogglePublish = async (courseId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await api.put(`/courses/${courseId}`, { is_published: newStatus });
      setCourses(courses.map(c => c.id === courseId ? { ...c, is_published: newStatus } : c));
      toast.success('Updated!', newStatus ? 'Course published!' : 'Course unpublished');
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to update status');
    }
  };

  const totalStudents = courses.reduce((acc, c) => acc + (c.enrollment_count || 0), 0);
  const publishedCount = courses.filter(c => c.is_published).length;

  const stats = [
    {
      icon: <BookOpen className="h-5 w-5 text-primary" />,
      value: courses.length,
      label: 'Total courses',
      bg: 'bg-primary/8 border-primary/15',
    },
    {
      icon: <Users className="h-5 w-5 text-emerald-500" />,
      value: totalStudents.toLocaleString(),
      label: 'Total students',
      bg: 'bg-emerald-500/8 border-emerald-500/15',
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-amber-500" />,
      value: publishedCount,
      label: 'Published',
      bg: 'bg-amber-500/8 border-amber-500/15',
    },
  ];

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-1">
              Instructor Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">Manage your courses and track performance</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Link to="/instructor/courses/create">
              <button className="btn-primary flex items-center gap-2 !py-2.5">
                <Plus className="h-4 w-4" />
                Create course
              </button>
            </Link>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className={`rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md ${stat.bg}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-background/80 flex items-center justify-center shadow-sm border border-border">
                  {stat.icon}
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className="font-display text-3xl font-black text-foreground">{stat.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Course list */}
        <div>
          <h2 className="font-display text-lg font-bold text-foreground mb-5 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Your courses
          </h2>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : courses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-base rounded-3xl py-20 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-5">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No courses yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Create your first course and start teaching!</p>
              <Link to="/instructor/courses/create">
                <button className="btn-primary flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  Create your first course
                </button>
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {courses.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-base rounded-2xl p-5 hover:border-primary/25 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title + badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-bold text-foreground text-base">{course.title}</h3>
                        <span className={`badge text-xs font-semibold ${
                          course.is_published
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </span>
                        {course.difficulty_level && (
                          <span className="badge-amber">{course.difficulty_level}</span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{course.description}</p>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-primary" />
                          <span>{course.lesson_count || 0} lessons</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{(course.enrollment_count || 0).toLocaleString()} students</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Link to={`/instructor/courses/${course.id}/lessons/create`}>
                        <button className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all" title="Add lesson">
                          <Plus className="h-4 w-4" />
                        </button>
                      </Link>
                      <Link to={`/instructor/courses/${course.id}/edit`}>
                        <button className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleTogglePublish(course.id, course.is_published)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                          course.is_published
                            ? 'border-border text-muted-foreground hover:text-amber-600 hover:border-amber-500/30 hover:bg-amber-500/5'
                            : 'border-primary/25 bg-primary/8 text-primary hover:bg-primary/15'
                        }`}
                      >
                        {course.is_published
                          ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</>
                          : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/25 hover:bg-destructive/5 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboard;
