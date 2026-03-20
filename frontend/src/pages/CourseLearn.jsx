import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';
import {
  Play, CheckCircle, ChevronLeft, ChevronRight,
  BookOpen, Clock, Star, Trophy, Menu, X,
  Loader2, AlertCircle, ArrowLeft, Award, Download
} from 'lucide-react';
import DiscussionSection from '../components/DiscussionSection';
import GamificationStats from '../components/GamificationStats';

const CourseLearn = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [certificateId, setCertificateId] = useState(null);
  const [gamificationResult, setGamificationResult] = useState(null);
  const [statsKey, setStatsKey] = useState(0); // increment to re-fetch stats
  const lessonStartTimeRef = useRef(Date.now());

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

      // Set initial lesson — from query param or first incomplete
      if (lessonsData.length > 0) {
        const queryLessonId = parseInt(searchParams.get('lesson'));
        const queryLesson = queryLessonId ? lessonsData.find(l => l.id === queryLessonId) : null;
        if (queryLesson) {
          setCurrentLesson(queryLesson);
        } else {
          const firstIncomplete = lessonsData.find(lesson => {
            const lessonProgress = progressData.find(p => p.lesson_id === lesson.id);
            return !lessonProgress?.is_completed;
          });
          setCurrentLesson(firstIncomplete || lessonsData[0]);
        }
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

  // Get the video URL for playback
  const getVideoUrl = useCallback((videoUrl) => {
    if (!videoUrl) return null;
    // Already a full URL (YouTube handled separately, external hosted videos)
    if (videoUrl.startsWith('http')) return videoUrl;

    // Uploaded video — use the streaming endpoint (supports Range requests for fast seeking)
    // video_url is saved as "/uploads/videos/filename.ext" in the DB
    if (videoUrl.includes('/uploads/videos/') || videoUrl.includes('/uploads\\videos\\')) {
      const filename = videoUrl.split(/[/\\]/).pop();
      return `${API_BASE_URL}/api/stream/video/${filename}`;
    }

    // Fallback: treat as a direct static path
    return `${API_BASE_URL}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
  }, [API_BASE_URL]);

  // Check if lesson is completed
  const isLessonCompleted = useCallback((lessonId) => {
    return progress.some(p => p.lesson_id === lessonId && Number(p.is_completed));
  }, [progress]);

  // Track time when lesson changes
  useEffect(() => {
    lessonStartTimeRef.current = Date.now();
    setGamificationResult(null);
  }, [currentLesson?.id]);

  // Handle marking lesson complete
  const handleMarkComplete = async () => {
    if (!currentLesson || marking) return;

    const timeSpentSeconds = Math.round((Date.now() - lessonStartTimeRef.current) / 1000);
    const timeSpentMinutes = Math.max(1, Math.round(timeSpentSeconds / 60)); // at least 1 minute

    try {
      setMarking(true);
      const response = await api.put(`/enrollments/lesson/${currentLesson.id}/complete`, {
        time_spent_minutes: timeSpentMinutes
      });

      if (response.data.alreadyCompleted) {
        showToast('Lesson already completed!', 'info');
        return;
      }

      // Update local progress
      setProgress(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(p => p.lesson_id === currentLesson.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], is_completed: true, completed_at: new Date() };
        } else {
          updated.push({ lesson_id: currentLesson.id, is_completed: true, completed_at: new Date() });
        }
        return updated;
      });

      // Show gamification results
      const gData = response.data.gamification;
      if (gData) {
        setGamificationResult({
          xpEarned: gData.xp?.earned || 0,
          totalXP: gData.xp?.total || 0,
          level: gData.xp?.level || 1,
          leveledUp: gData.xp?.leveledUp || false,
          streak: gData.streak?.current || 0,
          streakExtended: gData.streak?.extended || false,
          streakMilestone: gData.streak?.milestone || null,
          badges: gData.badges || [],
        });
      }

      if (response.data.course_completed) {
        setCourseCompleted(true);
        setPointsEarned(response.data.points_earned || 0);
        if (response.data.certificate_id) setCertificateId(response.data.certificate_id);
        if (response.data.points_balance !== undefined) updatePoints(response.data.points_balance);
        showToast(`🎉 Course completed! You earned ${response.data.points_earned} points!`, 'success');
        refreshPoints();
      } else {
        showToast(`✅ Lesson completed! +${gData?.xp?.earned || 0} XP`, 'success');
        const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);
        if (currentIndex < lessons.length - 1) {
          setTimeout(() => setCurrentLesson(lessons[currentIndex + 1]), 1200);
        }
      }
      setStatsKey(k => k + 1); // refresh gamification panel
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Error marking lesson as complete';
      showToast(errMsg, 'error');
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
    const completed = progress.filter(p => Number(p.is_completed)).length;
    return Math.round((completed / lessons.length) * 100);
  }, [progress, lessons]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-muted-foreground text-opacity-80">Course not found</h2>
      </div>
    );
  }

  const youtubeId = getYouTubeId(currentLesson.video_url);
  const localVideoUrl = !youtubeId ? getVideoUrl(currentLesson.video_url) : null;
  const isCurrentCompleted = isLessonCompleted(currentLesson.id);

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="bg-card border border-border shadow-sm border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/courses/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground truncate">{course.title}</h1>
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-card border border-border shadow-sm rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground text-opacity-80">{progressPercentage}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {course.points_reward > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-sm text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
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
            {certificateId && (
              <Button
                variant="outline"
                className="mt-3 ml-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                    const resp = await fetch(`${apiUrl}/certificates/${certificateId}/download`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!resp.ok) throw new Error();
                    const blob = await resp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `SkillVerse-Certificate-${certificateId}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error('Download error:', e);
                  }
                }}
              >
                <Award className="h-4 w-4 mr-2" />
                Download Certificate
              </Button>
            )}
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
                      <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                    </div>
                  )}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                      <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
                      <p className="text-foreground text-sm">Failed to load video</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-foreground border-border hover:bg-card border border-border shadow-sm"
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
            <div className="bg-card border border-border shadow-sm rounded-xl border border-border p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{currentLesson.title}</h2>
                  {currentLesson.duration_minutes && (
                    <p className="text-sm text-muted-foreground text-opacity-60 flex items-center gap-1 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {currentLesson.duration_minutes} min
                    </p>
                  )}
                </div>
                {!isCurrentCompleted ? (
                  <Button
                    onClick={handleMarkComplete}
                    disabled={marking}
                    className="shrink-0 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {marking ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {marking ? 'Saving...' : 'Mark as Complete'}
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg shrink-0 shadow-sm">
                    <CheckCircle className="h-4 w-4 fill-green-100" />
                    <span className="text-sm font-semibold">Completed</span>
                  </div>
                )}
              </div>

              {/* Gamification Result Panel */}
              {gamificationResult && (
                <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* XP Earned */}
                    <div className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2 shadow-sm">
                      <span className="text-lg">⚡</span>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">XP Earned</div>
                        <div className="text-base font-bold text-blue-700">+{gamificationResult.xpEarned} XP</div>
                      </div>
                    </div>

                    {/* Total XP */}
                    <div className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2 shadow-sm">
                      <span className="text-lg">🎯</span>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">Total XP</div>
                        <div className="text-base font-bold text-indigo-700">{gamificationResult.totalXP.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Streak */}
                    <div className="flex items-center gap-2 bg-white border border-orange-100 rounded-lg px-3 py-2 shadow-sm">
                      <span className="text-lg">{gamificationResult.streakExtended ? '🔥' : '✨'}</span>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">
                          {gamificationResult.streakExtended ? 'Streak Extended!' : 'Day Streak'}
                        </div>
                        <div className="text-base font-bold text-orange-600">{gamificationResult.streak} days</div>
                      </div>
                    </div>

                    {/* Level Up */}
                    {gamificationResult.leveledUp && (
                      <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-lg">🏆</span>
                        <div>
                          <div className="text-xs text-yellow-700 font-medium">LEVEL UP!</div>
                          <div className="text-base font-bold text-yellow-700">Level {gamificationResult.level}</div>
                        </div>
                      </div>
                    )}

                    {/* Streak Milestone */}
                    {gamificationResult.streakMilestone && (
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-lg">🎖️</span>
                        <div>
                          <div className="text-xs text-orange-700 font-medium">{gamificationResult.streakMilestone}-Day Milestone!</div>
                          <div className="text-base font-bold text-orange-700">Bonus XP Awarded</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* New Badges */}
                  {gamificationResult.badges.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="text-xs font-semibold text-blue-700 mb-2">🏅 New Badges Earned!</div>
                      <div className="flex flex-wrap gap-2">
                        {gamificationResult.badges.map((badge, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-3 py-1 text-xs font-medium text-blue-800 shadow-sm">
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            {badge.name}
                            {badge.xp_reward > 0 && <span className="text-blue-500 font-bold">+{badge.xp_reward} XP</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {currentLesson.description && (
                <p className="text-muted-foreground text-opacity-80 mb-4">{currentLesson.description}</p>
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

            {/* Per-lesson Discussion */}
            <DiscussionSection
              key={`lesson-discussion-${currentLesson.id}`}
              courseId={parseInt(id)}
              instructorId={course.instructor_id}
              lessonId={currentLesson.id}
            />
          </div>
        </div>

        {/* Sidebar - Lesson List + Gamification Stats */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-card border-l border-border overflow-hidden shrink-0`}>
          <div className="w-80 p-4 h-full overflow-y-auto space-y-4">
            {/* Lesson list */}
            <div>
              <h3 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wide text-muted-foreground">
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
                      className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 border border-blue-200 shadow-sm'
                          : 'hover:bg-zinc-50 border border-border bg-card shadow-sm'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        completed
                          ? 'bg-green-100 text-green-600'
                          : isCurrent
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-card border border-border text-muted-foreground'
                      }`}>
                        {completed ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${isCurrent ? 'font-semibold text-primary' : 'text-foreground'}`}>
                          {lesson.title}
                        </p>
                        {lesson.duration_minutes && (
                          <p className="text-xs text-muted-foreground mt-0.5">{lesson.duration_minutes} min</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LeetCode-style Gamification Stats */}
            <GamificationStats
              key={statsKey}
              lessonsCompleted={progress.filter(p => Number(p.is_completed)).length}
              totalLessons={lessons.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseLearn;
