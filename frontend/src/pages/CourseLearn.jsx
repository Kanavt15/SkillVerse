import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Play, CheckCircle, ChevronLeft, ChevronRight,
  BookOpen, Clock, Star, Trophy, Menu, X,
  Loader2, AlertCircle, ArrowLeft, Award, Zap, Flame
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
  const [statsKey, setStatsKey] = useState(0);
  const lessonStartTimeRef = useRef(Date.now());

  const API_BASE_URL = useMemo(() => {
    return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  }, []);

  useEffect(() => { fetchCourseData(); }, [id]);

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

  const getVideoUrl = useCallback((videoUrl) => {
    if (!videoUrl) return null;
    if (videoUrl.startsWith('http')) return videoUrl;
    if (videoUrl.includes('/uploads/videos/') || videoUrl.includes('/uploads\\videos\\')) {
      const filename = videoUrl.split(/[/\\]/).pop();
      return `${API_BASE_URL}/api/stream/video/${filename}`;
    }
    return `${API_BASE_URL}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
  }, [API_BASE_URL]);

  const isLessonCompleted = useCallback((lessonId) => {
    return progress.some(p => p.lesson_id === lessonId && Number(p.is_completed));
  }, [progress]);

  useEffect(() => {
    lessonStartTimeRef.current = Date.now();
    setGamificationResult(null);
  }, [currentLesson?.id]);

  const handleMarkComplete = async () => {
    if (!currentLesson || marking) return;
    const timeSpentSeconds = Math.round((Date.now() - lessonStartTimeRef.current) / 1000);
    const timeSpentMinutes = Math.max(1, Math.round(timeSpentSeconds / 60));

    try {
      setMarking(true);
      const response = await api.put(`/enrollments/lesson/${currentLesson.id}/complete`, {
        time_spent_minutes: timeSpentMinutes
      });

      if (response.data.alreadyCompleted) {
        showToast('Lesson already completed!', 'info');
        return;
      }

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
      setStatsKey(k => k + 1);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Error marking lesson as complete';
      showToast(errMsg, 'error');
    } finally {
      setMarking(false);
    }
  };

  const goToLesson = (lesson) => {
    setCurrentLesson(lesson);
    setVideoError(false);
    setVideoLoading(true);
    setSidebarOpen(false);
  };

  const progressPercentage = useMemo(() => {
    if (lessons.length === 0) return 0;
    const completed = progress.filter(p => Number(p.is_completed)).length;
    return Math.round((completed / lessons.length) * 100);
  }, [progress, lessons]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading course…</p>
        </div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center">
        <div>
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Course not found</h2>
          <p className="text-muted-foreground text-sm mt-1">Make sure you're enrolled in this course.</p>
        </div>
      </div>
    );
  }

  const youtubeId = getYouTubeId(currentLesson.video_url);
  const localVideoUrl = !youtubeId ? getVideoUrl(currentLesson.video_url) : null;
  const isCurrentCompleted = isLessonCompleted(currentLesson.id);
  const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* ── Top bar ── */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/courses/${id}`)}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground truncate text-sm md:text-base">{course.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full progress-bar rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{progressPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {course.points_reward > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 border border-primary/15 px-3 py-1.5 rounded-full">
              <Trophy className="h-3.5 w-3.5" />
              {course.points_reward} pts on completion
            </div>
          )}
          <button
            className="w-8 h-8 rounded-lg border border-border lg:hidden flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Course Completed Banner ── */}
      <AnimatePresence>
        {courseCompleted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500/10 via-primary/5 to-emerald-500/10 border-b border-border px-4 py-4">
              <div className="max-w-3xl mx-auto text-center">
                <div className="text-2xl mb-1">🎉🏆</div>
                <h2 className="text-lg font-bold text-foreground mb-1">Course Completed!</h2>
                <p className="text-muted-foreground text-sm">
                  You earned <strong className="text-amber-600">{pointsEarned} points</strong>. Keep learning to earn more!
                </p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => navigate('/courses')}
                    className="btn-outline text-sm !py-1.5"
                  >
                    Browse more courses
                  </button>
                  {certificateId && (
                    <button
                      className="btn-primary text-sm !py-1.5 gap-2"
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
                      <Award className="h-3.5 w-3.5" />
                      Download Certificate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Content area ── */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-4xl mx-auto px-4 py-6">

            {/* ── Video Player ── */}
            <div className="rounded-2xl overflow-hidden aspect-video mb-6 relative bg-[#0a0a0a] shadow-lg ring-1 ring-border">
              {youtubeId ? (
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
                <>
                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                      <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                      <p className="text-foreground text-sm mb-3">Failed to load video</p>
                      <button
                        className="btn-outline text-sm !py-1.5"
                        onClick={() => { setVideoError(false); setVideoLoading(true); }}
                      >
                        Retry
                      </button>
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
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No video for this lesson</p>
                </div>
              )}
            </div>

            {/* ── Lesson Info ── */}
            <div className="card-base rounded-2xl p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">{currentLesson.title}</h2>
                  {currentLesson.duration_minutes && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {currentLesson.duration_minutes} min
                    </p>
                  )}
                </div>
                {!isCurrentCompleted ? (
                  <motion.button
                    onClick={handleMarkComplete}
                    disabled={marking}
                    whileHover={!marking ? { scale: 1.02, y: -1 } : {}}
                    whileTap={!marking ? { scale: 0.98 } : {}}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {marking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {marking ? 'Saving…' : 'Mark as Complete'}
                  </motion.button>
                ) : (
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                    <CheckCircle className="h-4 w-4 fill-emerald-100" />
                    Completed
                  </div>
                )}
              </div>

              {/* ── Gamification result panel ── */}
              <AnimatePresence>
                {gamificationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* XP Earned */}
                        <div className="flex items-center gap-2 card-base rounded-xl px-3 py-2 shadow-sm">
                          <Zap className="h-4 w-4 text-primary fill-primary/20" />
                          <div>
                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">XP Earned</div>
                            <div className="text-sm font-bold text-primary">+{gamificationResult.xpEarned} XP</div>
                          </div>
                        </div>

                        {/* Total XP */}
                        <div className="flex items-center gap-2 card-base rounded-xl px-3 py-2 shadow-sm">
                          <span className="text-base">🎯</span>
                          <div>
                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total XP</div>
                            <div className="text-sm font-bold text-foreground">{gamificationResult.totalXP.toLocaleString()}</div>
                          </div>
                        </div>

                        {/* Streak */}
                        <div className="flex items-center gap-2 card-base rounded-xl px-3 py-2 shadow-sm">
                          <Flame className={`h-4 w-4 ${gamificationResult.streakExtended ? 'text-orange-500' : 'text-muted-foreground'}`} />
                          <div>
                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              {gamificationResult.streakExtended ? 'Streak Extended!' : 'Day Streak'}
                            </div>
                            <div className="text-sm font-bold text-foreground">{gamificationResult.streak}d</div>
                          </div>
                        </div>

                        {/* Level Up */}
                        {gamificationResult.leveledUp && (
                          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 shadow-sm">
                            <span className="text-base">🏆</span>
                            <div>
                              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">Level Up!</div>
                              <div className="text-sm font-bold text-amber-600">Level {gamificationResult.level}</div>
                            </div>
                          </div>
                        )}

                        {/* Streak Milestone */}
                        {gamificationResult.streakMilestone && (
                          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 shadow-sm">
                            <span className="text-base">🎖️</span>
                            <div>
                              <div className="text-[10px] text-orange-600 font-medium uppercase tracking-wide">{gamificationResult.streakMilestone}-Day Milestone!</div>
                              <div className="text-sm font-bold text-orange-600">Bonus XP Awarded</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* New Badges */}
                      {gamificationResult.badges.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-primary/15">
                          <div className="text-xs font-semibold text-primary mb-2">🏅 New Badges Earned!</div>
                          <div className="flex flex-wrap gap-2">
                            {gamificationResult.badges.map((badge, i) => (
                              <div key={i} className="flex items-center gap-1.5 card-base rounded-full px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                {badge.name}
                                {badge.xp_reward > 0 && <span className="text-primary font-bold">+{badge.xp_reward} XP</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {currentLesson.description && (
                <p className="text-muted-foreground mb-4 leading-relaxed">{currentLesson.description}</p>
              )}
              {currentLesson.content && (
                <div className="prose prose-sm max-w-none mt-4 pt-4 border-t border-border text-foreground">
                  <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                </div>
              )}
            </div>

            {/* ── Navigation buttons ── */}
            <div className="flex justify-between gap-3 mb-6">
              <button
                onClick={() => { if (currentIndex > 0) goToLesson(lessons[currentIndex - 1]); }}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => { if (currentIndex < lessons.length - 1) goToLesson(lessons[currentIndex + 1]); }}
                disabled={currentIndex === lessons.length - 1}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* ── Discussion ── */}
            <DiscussionSection
              key={`lesson-discussion-${currentLesson.id}`}
              courseId={parseInt(id)}
              instructorId={course.instructor_id}
              lessonId={currentLesson.id}
            />
          </div>
        </div>

        {/* ── Sidebar ── */}
        <motion.div
          animate={{ width: sidebarOpen ? 304 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="bg-card border-l border-border overflow-hidden shrink-0"
        >
          <div className="w-[304px] h-full overflow-y-auto p-4 space-y-4">

            {/* Lesson list header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lessons ({progress.filter(p => Number(p.is_completed)).length}/{lessons.length})
              </h3>
              <div className="text-xs font-semibold text-primary">{progressPercentage}%</div>
            </div>

            {/* Lesson items */}
            <div className="space-y-1.5">
              {lessons.map((lesson, index) => {
                const completed = isLessonCompleted(lesson.id);
                const isCurrent = currentLesson?.id === lesson.id;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => goToLesson(lesson)}
                    className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-all duration-150 ${
                      isCurrent
                        ? 'bg-primary/10 border border-primary/25 shadow-sm'
                        : 'hover:bg-muted border border-transparent hover:border-border'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      completed
                        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground shadow-teal'
                          : 'bg-muted border border-border text-muted-foreground'
                    }`}>
                      {completed ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate font-medium leading-snug ${isCurrent ? 'text-primary' : completed ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {lesson.title}
                      </p>
                      {lesson.duration_minutes && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {lesson.duration_minutes} min
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Gamification Stats */}
            <GamificationStats
              key={statsKey}
              lessonsCompleted={progress.filter(p => Number(p.is_completed)).length}
              totalLessons={lessons.length}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CourseLearn;
