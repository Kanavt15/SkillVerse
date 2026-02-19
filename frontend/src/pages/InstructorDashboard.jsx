import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Plus, BookOpen, Users, Edit, Trash2 } from 'lucide-react';

const InstructorDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInstructorCourses();
  }, []);

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
    if (!window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/courses/${courseId}`);
      setCourses(courses.filter((course) => course.id !== courseId));
      toast.success('Success!', 'Course deleted successfully');
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to delete course');
    }
  };

  const handleTogglePublish = async (courseId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await api.put(`/courses/${courseId}`, {
        is_published: newStatus
      });

      setCourses(
        courses.map((course) =>
          course.id === courseId
            ? { ...course, is_published: newStatus }
            : course
        )
      );
      toast.success(
        'Success!',
        newStatus ? 'Course published successfully!' : 'Course unpublished successfully'
      );
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to update course status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading your courses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Instructor Dashboard</h1>
            <p className="text-lg text-slate-400">
              Manage your courses and track student progress
            </p>
          </div>
          <Link to="/instructor/courses/create">
            <Button size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Course
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {courses.length}
              </CardTitle>
              <CardDescription>Total Courses</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {courses.reduce((acc, course) => acc + course.enrollment_count, 0)}
              </CardTitle>
              <CardDescription>Total Students</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {courses.filter((c) => c.is_published).length}
              </CardTitle>
              <CardDescription>Published Courses</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Courses List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Courses</h2>
          {courses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <p className="text-xl text-slate-400 mb-4">You haven't created any courses yet</p>
                <Link to="/instructor/courses/create">
                  <Button>
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Course
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => (
                <Card key={course.id} className="p-3 border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-slate-500">{course.title}</h3>
                          {course.is_published ? (
                            <Badge variant="secondary">Published</Badge>
                          ) : (
                            <Badge variant="outline">Draft</Badge>
                          )}
                        </div>
                        <p className="text-slate-400 mb-4 line-clamp-2">
                          {course.description}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-slate-400">
                          <div className="flex items-center">
                            <BookOpen className="h-4 w-4 mr-2" />
                            <span>{course.lesson_count} lessons</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            <span>{course.enrollment_count} students</span>
                          </div>
                          <Badge>{course.difficulty_level}</Badge>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Link to={`/instructor/courses/${course.id}/edit`}>
                          <Button variant="outline" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant={course.is_published ? 'outline' : 'default'}
                          onClick={() => handleTogglePublish(course.id, course.is_published)}
                        >
                          {course.is_published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteCourse(course.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboard;
