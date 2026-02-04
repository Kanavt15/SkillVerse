import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, CheckCircle, Circle, PlayCircle, Clock, ChevronRight, Trophy } from 'lucide-react';

const CourseLearn = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [progress, setProgress] = useState([]);
  const [enrollment, setEnrollment] = useState(null);

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  const fetchCourseData = async () => {
    try {
      // Fetch course details
      const courseRes = await api.get(`/courses/${id}`);
      setCourse(courseRes.data.course);

      // Fetch lessons
      const lessonsRes = await api.get(`/lessons/course/${id}`);
      setLessons(lessonsRes.data.lessons || []);

      // Fetch enrollment and progress
      const enrollmentsRes = await api.get('/enrollments');
      const currentEnrollment = enrollmentsRes.data.enrollments.find(
        (e) => e.course_id === parseInt(id)
      );
      
      if (currentEnrollment) {
        setEnrollment(currentEnrollment);
        
        // Fetch lesson progress
        const progressRes = await api.get(`/enrollments/course/${id}`);
        setProgress(progressRes.data.progress || []);

        // Set initial lesson (first incomplete or first lesson)
        const firstIncomplete = lessonsRes.data.lessons.find((lesson) => {
          const lessonProgress = progressRes.data.progress.find(
            (p) => p.lesson_id === lesson.id
          );
          return !lessonProgress?.is_completed;
        });
        
        setCurrentLesson(firstIncomplete || lessonsRes.data.lessons[0]);
      } else {
        toast.error('Not Enrolled', 'You are not enrolled in this course');
        navigate('/courses');
      }
    } catch (error) {
      toast.error('Error', 'Failed to load course data');
      navigate('/my-courses');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonComplete = async () => {
    if (!enrollment || !currentLesson) return;

    try {
      await api.put(`/enrollments/lesson/${currentLesson.id}/complete`);

      // Update progress
      setProgress((prev) => {
        const existing = prev.find((p) => p.lesson_id === currentLesson.id);
        if (existing) {
          return prev.map((p) =>
            p.lesson_id === currentLesson.id ? { ...p, is_completed: true } : p
          );
        }
        return [...prev, { lesson_id: currentLesson.id, is_completed: true }];
      });

      toast.success('Lesson Complete!', 'Great job! Moving to the next lesson.');

      // Move to next lesson
      const currentIndex = lessons.findIndex((l) => l.id === currentLesson.id);
      if (currentIndex < lessons.length - 1) {
        setCurrentLesson(lessons[currentIndex + 1]);
      } else {
        toast.success('🎉 Course Complete!', 'Congratulations! You\'ve completed all lessons!');
      }
    } catch (error) {
      toast.error('Error', 'Failed to mark lesson as complete');
    }
  };

  const isLessonCompleted = (lessonId) => {
    return progress.some((p) => p.lesson_id === lessonId && p.is_completed);
  };

  const getCompletedCount = () => {
    return progress.filter((p) => p.is_completed).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  const completedCount = getCompletedCount();
  const progressPercentage = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;
  const isCurrentLessonCompleted = currentLesson && isLessonCompleted(currentLesson.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/my-courses')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                My Courses
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{course?.title}</h1>
                <p className="text-sm text-gray-600">
                  {completedCount} of {lessons.length} lessons completed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {Math.round(progressPercentage)}%
                </p>
                <p className="text-xs text-gray-600">Complete</p>
              </div>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lesson Content */}
          <div className="lg:col-span-2">
            {currentLesson ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">
                      Lesson {lessons.findIndex((l) => l.id === currentLesson.id) + 1}
                    </Badge>
                    {isCurrentLessonCompleted && (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl">{currentLesson.title}</CardTitle>
                  {currentLesson.duration_minutes > 0 && (
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <Clock className="h-4 w-4 mr-2" />
                      {currentLesson.duration_minutes} minutes
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Video */}
                  {currentLesson.video_url && (
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                      {currentLesson.video_url.includes('youtube.com') ||
                      currentLesson.video_url.includes('youtu.be') ? (
                        <iframe
                          src={(() => {
                            const url = currentLesson.video_url;
                            // Handle youtube.com/watch?v=VIDEO_ID
                            if (url.includes('youtube.com/watch')) {
                              const videoId = new URL(url).searchParams.get('v');
                              return `https://www.youtube.com/embed/${videoId}`;
                            }
                            // Handle youtu.be/VIDEO_ID
                            if (url.includes('youtu.be/')) {
                              const videoId = url.split('youtu.be/')[1].split('?')[0];
                              return `https://www.youtube.com/embed/${videoId}`;
                            }
                            // Handle youtube.com/embed/VIDEO_ID (already embed format)
                            if (url.includes('youtube.com/embed/')) {
                              return url;
                            }
                            return url;
                          })()}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      ) : currentLesson.video_url.startsWith('/uploads/videos/') ? (
                        <video
                          src={`http://localhost:5000${currentLesson.video_url}`}
                          controls
                          className="w-full h-full"
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div className="flex items-center justify-center h-full text-white">
                          <div className="text-center">
                            <PlayCircle className="h-16 w-16 mx-auto mb-4" />
                            <a
                              href={currentLesson.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              Open Video in New Tab
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lesson Content */}
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {currentLesson.content}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    {!isCurrentLessonCompleted ? (
                      <Button onClick={handleLessonComplete} size="lg">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Mark as Complete
                      </Button>
                    ) : (
                      <Button variant="outline" disabled size="lg">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Completed
                      </Button>
                    )}

                    {lessons.findIndex((l) => l.id === currentLesson.id) < lessons.length - 1 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const currentIndex = lessons.findIndex((l) => l.id === currentLesson.id);
                          setCurrentLesson(lessons[currentIndex + 1]);
                        }}
                        size="lg"
                      >
                        Next Lesson
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Course Completed!</h3>
                  <p className="text-gray-600 mb-6">
                    Congratulations! You've completed all lessons in this course.
                  </p>
                  <Button onClick={() => navigate('/my-courses')}>
                    Back to My Courses
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Lesson List Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Course Content</CardTitle>
                <CardDescription>
                  {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lessons.map((lesson, index) => {
                    const isCompleted = isLessonCompleted(lesson.id);
                    const isCurrent = currentLesson?.id === lesson.id;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setCurrentLesson(lesson)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isCurrent
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {isCompleted ? (
                              <CheckCircle
                                className={`h-5 w-5 ${
                                  isCurrent ? 'text-white' : 'text-green-500'
                                }`}
                              />
                            ) : (
                              <Circle
                                className={`h-5 w-5 ${
                                  isCurrent ? 'text-white' : 'text-gray-400'
                                }`}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs font-medium ${
                                  isCurrent ? 'text-white' : 'text-gray-500'
                                }`}
                              >
                                Lesson {index + 1}
                              </span>
                              {lesson.is_free && (
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${isCurrent ? 'bg-white/20' : ''}`}
                                >
                                  Free
                                </Badge>
                              )}
                            </div>
                            <p
                              className={`text-sm font-medium line-clamp-2 ${
                                isCurrent ? 'text-white' : 'text-gray-900'
                              }`}
                            >
                              {lesson.title}
                            </p>
                            {lesson.duration_minutes > 0 && (
                              <div
                                className={`flex items-center text-xs mt-1 ${
                                  isCurrent ? 'text-white/80' : 'text-gray-500'
                                }`}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {lesson.duration_minutes} min
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseLearn;
