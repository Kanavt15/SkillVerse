import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Plus, BookOpen, Users, Edit, Trash2, Eye, EyeOff, Loader2, BarChart3 } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-400 mx-auto mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: <BookOpen className="h-5 w-5 text-violet-400" />,
      value: courses.length,
      label: 'Total Courses',
      bg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      icon: <Users className="h-5 w-5 text-emerald-400" />,
      value: totalStudents,
      label: 'Total Students',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-amber-400" />,
      value: publishedCount,
      label: 'Published',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Instructor Dashboard</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-sm">Manage your courses and track performance</p>
          </div>
          <Link to="/instructor/courses/create">
            <button className="btn-primary flex items-center gap-2 glow-violet-sm !py-2.5">
              <Plus className="h-5 w-5" />
              Create Course
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {statCards.map((stat, idx) => (
            <div key={idx} className={`rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 ${stat.bg}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  {stat.icon}
                </div>
                <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className="text-3xl font-black text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Courses List */}
        <div>
          <h2 className="text-lg font-bold text-white mb-5">Your Courses</h2>

          {courses.length === 0 ? (
            <div className="glass-card rounded-2xl py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
                <BookOpen className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No courses yet</h3>
              <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6">Create your first course and start teaching!</p>
              <Link to="/instructor/courses/create">
                <button className="btn-primary flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  Create Your First Course
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map(course => (
                <div
                  key={course.id}
                  className="glass-card rounded-2xl p-5 border border-white/6 hover:border-violet-500/20 transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Title & Status */}
                      <div className="flex flex-wrap items-center gap-2.5 mb-2">
                        <h3 className="font-bold text-white text-base">{course.title}</h3>
                        {course.is_published ? (
                          <span className="badge-emerald">Published</span>
                        ) : (
                          <span className="badge-violet">Draft</span>
                        )}
                        <span className="badge-gold">{course.difficulty_level}</span>
                      </div>

                      {/* Description */}
                      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-4 line-clamp-2">{course.description}</p>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-5 text-sm text-[hsl(var(--muted-foreground))]">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4 text-violet-400" />
                          <span>{course.lesson_count} lessons</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-emerald-400" />
                          <span>{course.enrollment_count} students</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/instructor/courses/${course.id}/edit`}>
                        <button className="p-2.5 rounded-xl border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-violet-500/30 hover:bg-violet-500/8 transition-all">
                          <Edit className="h-4 w-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleTogglePublish(course.id, course.is_published)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                          course.is_published
                            ? 'border-white/10 text-[hsl(var(--muted-foreground))] hover:text-amber-400 hover:border-amber-500/25 hover:bg-amber-500/8'
                            : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
                        }`}
                      >
                        {course.is_published
                          ? <><EyeOff className="h-4 w-4" /> Unpublish</>
                          : <><Eye className="h-4 w-4" /> Publish</>}
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="p-2.5 rounded-xl border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:border-red-500/25 hover:bg-red-500/8 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboard;
