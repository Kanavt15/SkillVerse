import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Clock, Users, BookOpen, CheckCircle, PlayCircle } from 'lucide-react';

const CourseDetail = () => {
  const { id } = useParams();
  const { isAuthenticated, isLearner } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    fetchCourseDetails();
    if (isAuthenticated) {
      checkEnrollment();
    }
  }, [id]);

  const fetchCourseDetails = async () => {
    try {
      const response = await api.get(`/courses/${id}`);
      setCourse(response.data.course);
    } catch (error) {
      console.error('Error fetching course:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollment = async () => {
    try {
      const response = await api.get('/enrollments');
      const isEnrolled = response.data.enrollments.some(
        (enrollment) => enrollment.course_id === parseInt(id)
      );
      setEnrolled(isEnrolled);
    } catch (error) {
      console.error('Error checking enrollment:', error);
    }
  };

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      toast.info('Login Required', 'Please login to enroll in this course');
      navigate('/login');
      return;
    }

    if (!isLearner) {
      toast.warning('Profile Update Required', 'Please update your profile to learner to enroll in courses');
      return;
    }

    setEnrolling(true);
    try {
      await api.post('/enrollments', { course_id: parseInt(id) });
      setEnrolled(true);
      toast.success('Enrolled!', 'Successfully enrolled in course! Start learning now.');
      navigate('/my-courses');
    } catch (error) {
      toast.error('Enrollment Failed', error.response?.data?.message || 'Failed to enroll in course');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading course...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Course not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{course.difficulty_level}</Badge>
                  <Badge variant="secondary">{course.category_name}</Badge>
                </div>
                <CardTitle className="text-3xl mb-2">{course.title}</CardTitle>
                <CardDescription className="text-base">
                  By {course.instructor_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">About This Course</h3>
                  <p className="text-gray-600">{course.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center text-gray-600">
                    <BookOpen className="h-5 w-5 mr-2" />
                    <span>{course.lesson_count} lessons</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="h-5 w-5 mr-2" />
                    <span>{course.enrollment_count} students</span>
                  </div>
                  {course.duration_hours && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-5 w-5 mr-2" />
                      <span>{course.duration_hours} hours</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4">Course Content</h3>
                  <div className="space-y-2">
                    {course.lessons && course.lessons.length > 0 ? (
                      course.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center">
                            <PlayCircle className="h-5 w-5 mr-3 text-primary" />
                            <div>
                              <p className="font-medium">{lesson.title}</p>
                              {lesson.duration_minutes && (
                                <p className="text-sm text-gray-600">
                                  {lesson.duration_minutes} minutes
                                </p>
                              )}
                            </div>
                          </div>
                          {lesson.is_free && (
                            <Badge variant="secondary">Free Preview</Badge>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600">No lessons available yet.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  {course.price > 0 ? (
                    <div className="text-4xl font-bold text-primary mb-2">
                      ${course.price}
                    </div>
                  ) : (
                    <div className="text-4xl font-bold text-primary mb-2">Free</div>
                  )}
                </div>

                {enrolled ? (
                  <Button
                    className="w-full mb-4"
                    onClick={() => navigate(`/my-courses/${id}`)}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Go to Course
                  </Button>
                ) : (
                  <Button
                    className="w-full mb-4"
                    onClick={handleEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? 'Enrolling...' : 'Enroll Now'}
                  </Button>
                )}

                <div className="space-y-4 text-sm text-gray-600">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      This course includes:
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        {course.lesson_count} video lessons
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Lifetime access
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Progress tracking
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
