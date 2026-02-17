import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';
import {
  Play, CheckCircle, ChevronLeft, ChevronRight,
  BookOpen, Clock, Star, Trophy, Menu, X,
  Loader2, AlertCircle, ArrowLeft
} from 'lucide-react';

const CourseLearn = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updatePoints, refreshPoints } = useAuth();
  const { showToast } = useToast();
  const videoRef = useRef(null);

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  // API base URL for local video files
  const API_BASE_URL = useMemo(() => {
    return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  }, []);

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [courseRes, lessonsRes, progressRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/lessons/course/${id}`),
        api.get(`/enrollments/course/${id}`)
      ]);

      const courseData = courseRes.data.course;
      const lessonsData = lessonsRes.data.lessons || [];
      const progressData = progressRes.data.progress || [];

      setCourse(courseData);
      setLessons(lessonsData);
      setProgress(progressData);

      // Set initial lesson (first incomplete or first)
      if (lessonsData.length > 0) {
        const firstIncomplete = lessonsData.find(lesson => {
          const lessonProgress = progressData.find(p => p.lesson_id === lesson.id);
          return !lessonProgress?.is_completed;
        });
        setCurrentLesson(firstIncomplete || lessonsData[0]);
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
      showToast('Error loading course. Make sure you are enrolled.', 'error');
      navigate('/my-courses');
    } finally {
      setLoading(false);
    }
  };

  // Extract YouTube video ID from various URL formats
  const getYouTubeId = useCallback((url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

  // Check if URL is a YouTube URL
  const isYouTubeUrl = useCallback((url) => {
    return !!getYouTubeId(url);
  }, [getYouTubeId]);

  // Get the streaming URL for uploaded videos
  const getVideoUrl = useCallback((videoUrl) => {
    if (!videoUrl) return null;
    if (videoUrl.startsWith('http')) return videoUrl;

    // Use the streaming endpoint for uploaded videos (supports Range requests for fast loading)
    if (videoUrl.startsWith('/uploads/videos/')) {
      const filename = videoUrl.split('/').pop();
      return `${API_BASE_URL}/api/stream/video/${filename}`;
    }

    return `${API_BASE_URL}${videoUrl}`;
  }, [API_BASE_URL]);

  // Check if lesson is completed
  const isLessonCompleted = useCallback((lessonId) => {
    return progress.some(p => p.lesson_id === lessonId && p.is_completed);
  }, [progress]);

  // Handle marking lesson complete
  const handleMarkComplete = async () => {
    if (!currentLesson || marking) return;

    try {
      setMarking(true);
      const response = await api.put(`/enrollments/lesson/${currentLesson.id}/complete`, {
        time_spent_minutes: currentLesson.duration_minutes || 0
      });

      // Update local progress
      setProgress(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(p => p.lesson_id === currentLesson.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], is_completed: true, completed_at: new Date() };
        }
        return updated;
      });

      if (response.data.course_completed) {
        // Course completed! Show celebration
        setCourseCompleted(true);
        setPointsEarned(response.data.points_earned || 0);
        if (response.data.points_balance !== undefined) {
          updatePoints(response.data.points_balance);
        }
        showToast(`🎉 Course completed! You earned ${response.data.points_earned} points!`, 'success');
      } else {
        showToast('Lesson completed!', 'success');
        // Auto-advance to next lesson
        const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);
        if (currentIndex < lessons.length - 1) {
          setCurrentLesson(lessons[currentIndex + 1]);
        }
      }
    } catch (error) {
      showToast('Error marking lesson as complete', 'error');
    } finally {
      setMarking(false);
    }
  };

  // Navigate between lessons
  const goToLesson = (lesson) => {
    setCurrentLesson(lesson);
    setVideoError(false);
    setVideoLoading(true);
    setSidebarOpen(false);
  };

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (lessons.length === 0) return 0;
    const completed = progress.filter(p => p.is_completed).length;
    return Math.round((completed / lessons.length) * 100);
  }, [progress, lessons]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-500">Course not found</h2>
      </div>
    );
  }

  const youtubeId = getYouTubeId(currentLesson.video_url);
  const localVideoUrl = !youtubeId ? getVideoUrl(currentLesson.video_url) : null;
  const isCurrentCompleted = isLessonCompleted(currentLesson.id);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/courses/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">{course.title}</h1>
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{progressPercentage}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {course.points_reward > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <Trophy className="h-3.5 w-3.5" />
              <span>{course.points_reward} pts on completion</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Course Completed Celebration */}
      {courseCompleted && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200 px-4 py-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-3xl mb-2">🎉🏆</div>
            <h2 className="text-xl font-bold text-amber-800 mb-1">Course Completed!</h2>
            <p className="text-amber-700">
              You earned <strong>{pointsEarned}</strong> points. Keep learning to earn more!
            </p>
            <Button
              variant="outline"
              className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => navigate('/courses')}
            >
              Browse More Courses
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Video Player */}
            <div className="bg-black rounded-xl overflow-hidden aspect-video mb-6 relative">
              {youtubeId ? (
                /* YouTube Embed — uses youtube-nocookie for faster loads, privacy */
                <iframe
                  key={youtubeId}
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                  title={`Video: ${currentLesson.title}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              ) : localVideoUrl ? (
                /* Local Video — uses streaming endpoint with Range headers for fast seeking */
                <>
                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                      <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
                      <p className="text-white text-sm">Failed to load video</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-white border-white/30 hover:bg-white/10"
                        onClick={() => { setVideoError(false); setVideoLoading(true); }}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    key={localVideoUrl}
                    src={localVideoUrl}
                    className="w-full h-full"
                    controls
                    preload="metadata"
                    controlsList="nodownload"
                    onLoadStart={() => setVideoLoading(true)}
                    onLoadedData={() => setVideoLoading(false)}
                    onCanPlay={() => setVideoLoading(false)}
                    onError={() => { setVideoLoading(false); setVideoError(true); }}
                  />
                </>
              ) : (
                /* No Video */
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
                  <BookOpen className="h-12 w-12 text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm">No video for this lesson</p>
                </div>
              )}
            </div>

            {/* Lesson Info */}
            <div className="bg-white rounded-xl border p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{currentLesson.title}</h2>
                  {currentLesson.duration_minutes && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {currentLesson.duration_minutes} min
                    </p>
                  )}
                </div>
                {!isCurrentCompleted ? (
                  <Button
                    onClick={handleMarkComplete}
                    disabled={marking}
                    className="shrink-0"
                  >
                    {marking ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Mark Complete
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-4 py-2 rounded-lg shrink-0">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                )}
              </div>
              {currentLesson.description && (
                <p className="text-gray-600 mb-4">{currentLesson.description}</p>
              )}
              {currentLesson.content && (
                <div className="prose prose-sm max-w-none mt-4 pt-4 border-t">
                  <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  const idx = lessons.findIndex(l => l.id === currentLesson.id);
                  if (idx > 0) goToLesson(lessons[idx - 1]);
                }}
                disabled={lessons.findIndex(l => l.id === currentLesson.id) === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const idx = lessons.findIndex(l => l.id === currentLesson.id);
                  if (idx < lessons.length - 1) goToLesson(lessons[idx + 1]);
                }}
                disabled={lessons.findIndex(l => l.id === currentLesson.id) === lessons.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Lesson List */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-l overflow-hidden shrink-0`}>
          <div className="w-80 p-4 h-full overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">
              Lessons ({progress.filter(p => p.is_completed).length}/{lessons.length})
            </h3>
            <div className="space-y-1">
              {lessons.map((lesson, index) => {
                const completed = isLessonCompleted(lesson.id);
                const isCurrent = currentLesson?.id === lesson.id;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => goToLesson(lesson)}
                    className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${isCurrent
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${completed
                        ? 'bg-green-100 text-green-600'
                        : isCurrent
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                      {completed ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${isCurrent ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                        {lesson.title}
                      </p>
                      {lesson.duration_minutes && (
                        <p className="text-xs text-gray-400 mt-0.5">{lesson.duration_minutes} min</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseLearn;
