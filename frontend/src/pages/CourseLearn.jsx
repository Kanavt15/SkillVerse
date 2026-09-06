import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CheckCircle, ChevronLeft, ChevronRight,
  BookOpen, Clock, Trophy, Menu, X,
  Loader2, AlertCircle, ArrowLeft, Award, Zap, Flame,
  MessageSquare, FileText, FlaskConical, GripVertical,
  Play, SkipForward, Star, ChevronDown, ChevronUp
} from 'lucide-react';
import DiscussionSection from '../components/DiscussionSection';
import GamificationStats from '../components/GamificationStats';
import CodeSandbox from '../components/CodeSandbox';

/* ─── Progress ring ─── */
const ProgressRing = ({ percent, size = 40, stroke = 3 }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke}/>
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
};

/* ─── Resizable sidebar hook ─── */
function useResizableSidebar(defaultWidth = 320, min = 240, max = 520) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const startResize = useCallback((e) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newW = Math.max(min, Math.min(max, startW.current + delta));
      setWidth(newW);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [min, max]);

  return { width, startResize };
}

/* ─── Main component ─── */
const CourseLearn = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updatePoints, refreshPoints } = useAuth();
  const { showToast } = useToast();
  const videoRef = useRef(null);
  const { width: sidebarWidth, startResize } = useResizableSidebar(320);

  const [course, setCourse]                 = useState(null);
  const [lessons, setLessons]               = useState([]);
  const [progress, setProgress]             = useState([]);
  const [currentLesson, setCurrentLesson]   = useState(null);
  const [loading, setLoading]               = useState(true);
  const [marking, setMarking]               = useState(false);
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [videoLoading, setVideoLoading]     = useState(false);
  const [videoError, setVideoError]         = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [pointsEarned, setPointsEarned]     = useState(0);
  const [certificateId, setCertificateId]   = useState(null);
  const [gamificationResult, setGamificationResult] = useState(null);
  const [statsKey, setStatsKey]             = useState(0);
  const [activeTab, setActiveTab]           = useState('description');
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const lessonStartTimeRef = useRef(Date.now());

  const API_BASE_URL = useMemo(() =>
    import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'
  , []);

  useEffect(() => { fetchCourseData(); }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [courseRes, lessonsRes, progressRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/lessons/course/${id}`),
        api.get(`/enrollments/course/${id}`)
      ]);
      const courseData    = courseRes.data.course;
      const lessonsData   = lessonsRes.data.lessons || [];
      const progressData  = progressRes.data.progress || [];
      setCourse(courseData);
      setLessons(lessonsData);
      setProgress(progressData);
      if (lessonsData.length > 0) {
        const qId = parseInt(searchParams.get('lesson'));
        const qLesson = qId ? lessonsData.find(l => l.id === qId) : null;
        const firstIncomplete = lessonsData.find(l =>
          !progressData.find(p => p.lesson_id === l.id)?.is_completed
        );
        setCurrentLesson(qLesson || firstIncomplete || lessonsData[0]);
      }
    } catch {
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
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }, []);

  const getVideoUrl = useCallback((videoUrl) => {
    if (!videoUrl) return null;
    if (videoUrl.startsWith('http')) return videoUrl;
    if (videoUrl.includes('/uploads/videos/') || videoUrl.includes('/uploads\\videos\\')) {
      return `${API_BASE_URL}/api/stream/video/${videoUrl.split(/[/\\]/).pop()}`;
    }
    return `${API_BASE_URL}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
  }, [API_BASE_URL]);

  const isLessonCompleted = useCallback((lessonId) =>
    progress.some(p => p.lesson_id === lessonId && Number(p.is_completed))
  , [progress]);

  useEffect(() => {
    lessonStartTimeRef.current = Date.now();
    setGamificationResult(null);
    setActiveTab('description');
  }, [currentLesson?.id]);

  const handleMarkComplete = async () => {
    if (!currentLesson || marking) return;
    const minutes = Math.max(1, Math.round((Date.now() - lessonStartTimeRef.current) / 60000));
    try {
      setMarking(true);
      const res = await api.put(`/enrollments/lesson/${currentLesson.id}/complete`, { time_spent_minutes: minutes });
      if (res.data.alreadyCompleted) { showToast('Already completed!', 'info'); return; }

      setProgress(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(p => p.lesson_id === currentLesson.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], is_completed: true };
        else updated.push({ lesson_id: currentLesson.id, is_completed: true });
        return updated;
      });

      const g = res.data.gamification;
      if (g) setGamificationResult({
        xpEarned: g.xp?.earned || 0, totalXP: g.xp?.total || 0,
        level: g.xp?.level || 1, leveledUp: g.xp?.leveledUp || false,
        streak: g.streak?.current || 0, streakExtended: g.streak?.extended || false,
        streakMilestone: g.streak?.milestone || null, badges: g.badges || [],
      });

      if (res.data.course_completed) {
        setCourseCompleted(true);
        setPointsEarned(res.data.points_earned || 0);
        if (res.data.certificate_id) setCertificateId(res.data.certificate_id);
        if (res.data.points_balance !== undefined) updatePoints(res.data.points_balance);
        showToast(`🎉 Course completed! +${res.data.points_earned} points!`, 'success');
        refreshPoints();
      } else {
        showToast(`✅ Lesson done! +${g?.xp?.earned || 0} XP`, 'success');
        const ci = lessons.findIndex(l => l.id === currentLesson.id);
        if (ci < lessons.length - 1) setTimeout(() => setCurrentLesson(lessons[ci + 1]), 1200);
      }
      setStatsKey(k => k + 1);
    } catch (e) {
      showToast(e.response?.data?.message || 'Error marking lesson', 'error');
    } finally { setMarking(false); }
  };

  const goToLesson = (lesson) => {
    setCurrentLesson(lesson);
    setVideoError(false);
    setVideoLoading(true);
  };

  const progressPercentage = useMemo(() => {
    if (!lessons.length) return 0;
    return Math.round((progress.filter(p => Number(p.is_completed)).length / lessons.length) * 100);
  }, [progress, lessons]);

  const completedCount = useMemo(() =>
    progress.filter(p => Number(p.is_completed)).length
  , [progress]);

  /* ─── Loading ─── */
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading course…</p>
      </div>
    </div>
  );

  if (!course || !currentLesson) return (
    <div className="flex items-center justify-center h-screen bg-background text-center">
      <div className="space-y-4 p-8">
        <div className="w-16 h-16 rounded-3xl bg-muted mx-auto flex items-center justify-center border border-border">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Course not found</h2>
        <p className="text-muted-foreground text-sm">Make sure you're enrolled.</p>
      </div>
    </div>
  );

  const youtubeId = getYouTubeId(currentLesson.video_url);
  const localVideoUrl = !youtubeId ? getVideoUrl(currentLesson.video_url) : null;
  const isCurrentCompleted = isLessonCompleted(currentLesson.id);
  const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);

  const TABS = [
    { key: 'description', label: 'Overview',   icon: FileText },
    { key: 'discussion',  label: 'Discussion', icon: MessageSquare },
    { key: 'sandbox',     label: 'Sandbox',    icon: FlaskConical, badge: 'NEW' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ══════════════ TOP NAV BAR ══════════════ */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-border bg-card/80 backdrop-blur-md z-20">
        {/* Left: back + course name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/courses/${id}`)}
            className="shrink-0 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group"
            aria-label="Back to course"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{course.title}</p>
            <p className="text-sm font-semibold text-foreground truncate">{currentLesson.title}</p>
          </div>
        </div>

        {/* Center: progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            {/* Step pills */}
            <div className="flex items-center gap-1">
              {lessons.slice(0, Math.min(12, lessons.length)).map((l, i) => {
                const done = isLessonCompleted(l.id);
                const curr = currentLesson.id === l.id;
                return (
                  <button key={l.id} onClick={() => goToLesson(l)}
                    className={`w-2 h-2 rounded-full transition-all ${curr ? 'bg-primary scale-125' : done ? 'bg-emerald-500' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
                    title={l.title}
                  />
                );
              })}
              {lessons.length > 12 && <span className="text-[10px] text-muted-foreground ml-1">+{lessons.length-12}</span>}
            </div>
            <span className="text-xs text-muted-foreground font-medium">{completedCount}/{lessons.length}</span>
          </div>
          <div className="relative">
            <ProgressRing percent={progressPercentage} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-primary">{progressPercentage}%</span>
          </div>
          {course.points_reward > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              <Trophy className="h-3.5 w-3.5" />
              {course.points_reward} pts
            </div>
          )}
        </div>

        {/* Right: sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            sidebarOpen ? 'border-primary/30 bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Menu className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Lessons</span>
        </button>
      </header>

      {/* ══════════════ COURSE COMPLETED BANNER ══════════════ */}
      <AnimatePresence>
        {courseCompleted && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-500/10 to-amber-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Course Complete!</p>
                  <p className="text-xs text-muted-foreground">You earned <strong className="text-amber-600">{pointsEarned} pts</strong></p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigate('/courses')} className="btn-outline text-xs !py-1 !px-3">Browse more</button>
                {certificateId && (
                  <button className="btn-primary text-xs !py-1 !px-3 gap-1.5" onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                      const resp = await fetch(`${apiUrl}/certificates/${certificateId}/download`, { headers: { Authorization: `Bearer ${token}` } });
                      if (!resp.ok) throw new Error();
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = Object.assign(document.createElement('a'), { href: url, download: `SkillVerse-Certificate-${certificateId}.pdf` });
                      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    } catch { /* noop */ }
                  }}>
                    <Award className="h-3.5 w-3.5" /> Certificate
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════ MAIN BODY ══════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Content pane ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

            {/* Video player */}
            <div className="rounded-2xl overflow-hidden aspect-video mb-5 bg-black shadow-2xl ring-1 ring-white/5 relative">
              {youtubeId ? (
                <iframe key={youtubeId}
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                  title={currentLesson.title} className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen loading="lazy"
                />
              ) : localVideoUrl ? (
                <>
                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                      <Loader2 className="h-10 w-10 animate-spin text-white/60" />
                    </div>
                  )}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10 gap-3">
                      <AlertCircle className="h-10 w-10 text-destructive" />
                      <p className="text-foreground text-sm">Failed to load video</p>
                      <button className="btn-outline text-sm !py-1.5" onClick={() => { setVideoError(false); setVideoLoading(true); }}>Retry</button>
                    </div>
                  )}
                  <video ref={videoRef} key={localVideoUrl} src={localVideoUrl}
                    className="w-full h-full" controls preload="metadata" controlsList="nodownload"
                    onLoadStart={() => setVideoLoading(true)}
                    onLoadedData={() => setVideoLoading(false)}
                    onCanPlay={() => setVideoLoading(false)}
                    onError={() => { setVideoLoading(false); setVideoError(true); }}
                  />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/20 to-muted/5">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-white/20" />
                  </div>
                  <p className="text-white/30 text-sm">No video for this lesson</p>
                </div>
              )}
            </div>

            {/* Lesson header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    Lesson {currentIndex + 1}/{lessons.length}
                  </span>
                  {isCurrentCompleted && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                      <CheckCircle className="h-3 w-3" /> Completed
                    </span>
                  )}
                  {currentLesson.duration_minutes && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {currentLesson.duration_minutes} min
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl font-extrabold text-foreground leading-tight">{currentLesson.title}</h2>
              </div>
              {/* Mark complete / Completed */}
              {!isCurrentCompleted ? (
                <motion.button
                  onClick={handleMarkComplete} disabled={marking}
                  whileHover={!marking ? { scale: 1.02, y: -1 } : {}}
                  whileTap={!marking ? { scale: 0.97 } : {}}
                  className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-60"
                >
                  {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {marking ? 'Saving…' : 'Mark Complete'}
                </motion.button>
              ) : (
                <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-bold">
                  <CheckCircle className="h-4 w-4 fill-emerald-100" /> Completed
                </div>
              )}
            </div>

            {/* Gamification result */}
            <AnimatePresence>
              {gamificationResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="p-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-cyan-500/5">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">🎉 Lesson Rewards</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { icon: Zap, label: 'XP Earned', value: `+${gamificationResult.xpEarned}`, color: 'text-primary', bg: 'bg-primary/8 border-primary/20' },
                        { icon: Star, label: 'Total XP', value: gamificationResult.totalXP.toLocaleString(), color: 'text-cyan-500', bg: 'bg-cyan-500/8 border-cyan-500/20' },
                        { icon: Flame, label: gamificationResult.streakExtended ? 'Streak 🔥' : 'Streak', value: `${gamificationResult.streak}d`, color: gamificationResult.streakExtended ? 'text-orange-500' : 'text-muted-foreground', bg: 'bg-orange-500/5 border-orange-500/15' },
                      ].map((s, i) => (
                        <motion.div key={i} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.08 }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${s.bg}`}>
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                          <div>
                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</div>
                            <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
                          </div>
                        </motion.div>
                      ))}
                      {gamificationResult.leveledUp && (
                        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring' }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10">
                          <span className="text-lg">🏆</span>
                          <div>
                            <div className="text-[10px] text-amber-600 font-bold uppercase">Level Up!</div>
                            <div className="text-sm font-black text-amber-600">Lv. {gamificationResult.level}</div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                    {gamificationResult.badges.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-primary/10">
                        <p className="text-xs font-bold text-primary mb-2">🏅 Badges Earned</p>
                        <div className="flex flex-wrap gap-2">
                          {gamificationResult.badges.map((b, i) => (
                            <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.05, type: 'spring' }}
                              className="flex items-center gap-1.5 card-base rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              {b.name}
                              {b.xp_reward > 0 && <span className="text-primary font-black">+{b.xp_reward}</span>}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Prev / Next nav */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <button
                onClick={() => currentIndex > 0 && goToLesson(lessons[currentIndex - 1])}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <div className="text-xs text-muted-foreground">{currentIndex + 1} / {lessons.length}</div>
              <button
                onClick={() => currentIndex < lessons.length - 1 && goToLesson(lessons[currentIndex + 1])}
                disabled={currentIndex === lessons.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-0.5 mb-6 border-b border-border">
              {TABS.map(({ key, label, icon: Icon, badge }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`group flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
                    activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}>
                  <Icon className={`h-4 w-4 ${activeTab === key ? 'text-primary' : ''}`} />
                  {label}
                  {badge && <span className="bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">{badge}</span>}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'description' && (
                <motion.div key="desc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}
                  className="card-base rounded-2xl p-6 mb-8">
                  {currentLesson.description
                    ? <p className="text-muted-foreground leading-relaxed text-[15px]">{currentLesson.description}</p>
                    : <p className="text-muted-foreground text-sm italic">No description for this lesson.</p>
                  }
                  {currentLesson.content && (
                    <div className="prose prose-sm max-w-none mt-4 pt-4 border-t border-border text-foreground">
                      <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                    </div>
                  )}
                </motion.div>
              )}
              {activeTab === 'discussion' && (
                <motion.div key="disc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }} className="mb-8">
                  <DiscussionSection key={`disc-${currentLesson.id}`} courseId={parseInt(id)} instructorId={course.instructor_id} lessonId={currentLesson.id} />
                </motion.div>
              )}
              {activeTab === 'sandbox' && (
                <motion.div key="sandbox" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }} className="mb-8">
                  {/* Sandbox header */}
                  <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-cyan-500/5 border border-primary/10">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <FlaskConical className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">Knowledge Sandbox</h3>
                      <p className="text-xs text-muted-foreground">Write, run and test code based on <span className="text-primary font-medium">"{currentLesson.title}"</span></p>
                    </div>
                  </div>
                  <CodeSandbox lessonTitle={currentLesson.title} lessonTopic={course.category_name} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ══════════════ RESIZABLE SIDEBAR ══════════════ */}
        {sidebarOpen && (
          <>
            {/* Drag handle */}
            <div
              onMouseDown={startResize}
              className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors group flex items-center justify-center relative z-10"
              title="Drag to resize"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
            </div>

            {/* Sidebar panel */}
            <div
              className="shrink-0 bg-card border-l border-border flex flex-col overflow-hidden"
              style={{ width: sidebarWidth }}
            >
              {/* Sidebar top header */}
              <div className="px-4 py-3 border-b border-border shrink-0 bg-card/95 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Course Content</span>
                  <button onClick={() => setSidebarOpen(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{completedCount} of {lessons.length} lessons</span>
                    <span className="font-bold text-primary">{progressPercentage}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>

              {/* Lesson list */}
              <div className="flex-1 overflow-y-auto py-2 px-2">
                {lessons.map((lesson, index) => {
                  const done = isLessonCompleted(lesson.id);
                  const curr = currentLesson.id === lesson.id;
                  return (
                    <button key={lesson.id} onClick={() => goToLesson(lesson)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all group ${
                        curr ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      {/* Step bubble */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black border transition-all ${
                        done ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600' :
                        curr ? 'bg-primary border-primary text-white shadow-md shadow-primary/30' :
                        'bg-muted border-border text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate leading-snug ${
                          curr ? 'text-primary' : done ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}>
                          {lesson.title}
                        </p>
                        {lesson.duration_minutes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {lesson.duration_minutes} min
                          </p>
                        )}
                      </div>
                      {curr && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* Gamification stats (collapsible) */}
              <div className="shrink-0 border-t border-border">
                <button
                  onClick={() => setStatsCollapsed(c => !c)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
                >
                  Your Progress
                  {statsCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>
                <AnimatePresence>
                  {!statsCollapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3">
                        <GamificationStats key={statsKey} lessonsCompleted={completedCount} totalLessons={lessons.length} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseLearn;
