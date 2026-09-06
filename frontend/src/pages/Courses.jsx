import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import {
  Search, Star, Users, BookOpen, Loader2, Play,
  ChevronLeft, ChevronRight, SlidersHorizontal, X,
  Filter, Clock, GraduationCap, TrendingUp, Sparkles,
  Zap, ArrowRight, Tag, BarChart3, Grid3X3, List, Target
} from 'lucide-react';
import TagFilter from '../components/TagFilter';

/* ─── Skeleton ─── */
const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden bg-card border border-border">
    <div className="aspect-video skeleton" />
    <div className="p-5 space-y-3">
      <div className="flex gap-2"><div className="h-5 w-20 skeleton rounded-full" /><div className="h-5 w-16 skeleton rounded-full" /></div>
      <div className="h-5 w-4/5 skeleton rounded-lg" />
      <div className="h-4 w-full skeleton rounded-lg" />
      <div className="h-4 w-3/4 skeleton rounded-lg" />
      <div className="flex justify-between pt-2 border-t border-border">
        <div className="h-4 w-20 skeleton rounded-full" />
        <div className="h-4 w-20 skeleton rounded-full" />
      </div>
    </div>
  </div>
);

/* ─── Stars ─── */
const Stars = ({ rating }) => {
  const r = parseFloat(rating) || 0;
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`h-3 w-3 ${s <= Math.round(r) ? 'text-amber-400 fill-amber-400' : 'text-muted'}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{r > 0 ? r.toFixed(1) : '—'}</span>
    </div>
  );
};

const DIFFICULTY = {
  beginner:     { cls: 'badge-emerald', label: 'Beginner',     color: 'bg-emerald-400' },
  intermediate: { cls: 'badge-amber',   label: 'Intermediate', color: 'bg-amber-400'   },
  advanced:     { cls: 'badge-red',     label: 'Advanced',     color: 'bg-red-400'     },
};

const Courses = () => {
  const [courses, setCourses]       = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode]     = useState('grid'); // 'grid' | 'list'
  const [filters, setFilters] = useState({
    category_id: '', difficulty_level: '', search: '', sort_by: 'newest',
    tags: [], tag_logic: 'or', min_rating: '', max_price: '', min_duration: '', max_duration: '',
  });
  const searchRef = useRef(null);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchCourses(1); }, [
    filters.category_id, filters.difficulty_level, filters.sort_by,
    filters.tags, filters.tag_logic, filters.min_rating, filters.max_price,
    filters.min_duration, filters.max_duration,
  ]);

  const fetchCourses = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 12 };
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.difficulty_level) params.difficulty_level = filters.difficulty_level;
      if (filters.search) params.search = filters.search;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.tags?.length > 0) { params.tags = filters.tags.join(','); params.tag_logic = filters.tag_logic; }
      if (filters.min_rating) params.min_rating = filters.min_rating;
      if (filters.max_price) params.max_price = filters.max_price;
      if (filters.min_duration) params.min_duration = filters.min_duration;
      if (filters.max_duration) params.max_duration = filters.max_duration;
      const res = await api.get('/courses', { params });
      setCourses(res.data.courses);
      setPagination(res.data.pagination || { currentPage: page, totalPages: 1, totalCourses: res.data.count });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.categories || []);
    } catch { /* noop */ }
  };

  const handleSearch = (e) => { e.preventDefault(); fetchCourses(1); };
  const handlePageChange = (p) => { fetchCourses(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const clearFilters = () => setFilters({
    category_id: '', difficulty_level: '', search: '', sort_by: 'newest',
    tags: [], tag_logic: 'or', min_rating: '', max_price: '', min_duration: '', max_duration: '',
  });
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const hasActive = filters.search || filters.tags.length > 0 || filters.min_rating ||
    filters.max_price || filters.category_id || filters.difficulty_level;

  const getThumbnailUrl = (t) => {
    if (!t) return null;
    if (t.startsWith('http')) return t;
    return `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${t}`;
  };

  const getCost = (c) => c.points_cost ?? c.price ?? 0;

  const getPages = () => {
    const { currentPage: cp, totalPages: tp } = pagination;
    const arr = []; const vis = 5;
    let s = Math.max(1, cp - Math.floor(vis / 2));
    let e = Math.min(tp, s + vis - 1);
    if (e - s < vis - 1) s = Math.max(1, e - vis + 1);
    for (let i = s; i <= e; i++) arr.push(i);
    return arr;
  };

  /* ─── Course Card (grid) ─── */
  const CourseCard = ({ course, index }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link to={`/courses/${course.id}`} className="group block h-full">
        <div className="h-full flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/8 hover:border-primary/25">
          {/* Thumbnail */}
          <div className="aspect-video relative overflow-hidden bg-muted">
            {course.thumbnail ? (
              <img src={getThumbnailUrl(course.thumbnail)} alt={course.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/8 to-cyan-500/8 flex items-center justify-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground/20" />
              </div>
            )}
            {/* Hover CTA */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-4">
              <span className="flex items-center gap-1.5 text-white text-sm font-bold">
                <Play className="h-4 w-4 fill-white" /> Start Learning
              </span>
            </div>
            {/* Top badges */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
              {course.difficulty_level && DIFFICULTY[course.difficulty_level] && (
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/10">
                  <div className={`w-1.5 h-1.5 rounded-full ${DIFFICULTY[course.difficulty_level].color}`} />
                  <span className="text-[10px] font-semibold text-white">{DIFFICULTY[course.difficulty_level].label}</span>
                </div>
              )}
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/10 ml-auto">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-bold text-white">{getCost(course) === 0 ? 'Free' : `${getCost(course)} pts`}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col p-5">
            {course.category_name && (
              <span className="badge-teal mb-3 self-start">{course.category_name}</span>
            )}
            <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {course.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1 mb-3">
              {course.description}
            </p>
            <Stars rating={course.avg_rating} />
            {course.instructor_name && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary font-black text-[8px] flex items-center justify-center shrink-0">
                  {course.instructor_name[0]?.toUpperCase()}
                </span>
                {course.instructor_name}
              </p>
            )}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{course.lesson_count || 0} lessons</span>
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{(course.enrollment_count || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );

  /* ─── Course Card (list) ─── */
  const CourseListItem = ({ course, index }) => (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.03 }}>
      <Link to={`/courses/${course.id}`} className="group flex gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 transition-all">
        <div className="w-32 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
          {course.thumbnail
            ? <img src={getThumbnailUrl(course.thumbnail)} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center bg-primary/5"><GraduationCap className="h-8 w-8 text-primary/20" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {course.category_name && <span className="badge-teal text-[10px]">{course.category_name}</span>}
            {course.difficulty_level && DIFFICULTY[course.difficulty_level] && (
              <span className={`text-[10px] font-semibold ${DIFFICULTY[course.difficulty_level].cls}`}>{DIFFICULTY[course.difficulty_level].label}</span>
            )}
          </div>
          <h3 className="font-bold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{course.description}</p>
          <div className="flex items-center gap-4 mt-2">
            <Stars rating={course.avg_rating} />
            <span className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="h-3 w-3" />{course.lesson_count || 0}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{(course.enrollment_count || 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg self-start mt-1">
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
          {getCost(course) === 0 ? 'Free' : `${getCost(course)} pts`}
        </div>
      </Link>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background pt-16">

      {/* ══════════════ HERO SECTION ══════════════ */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/6 via-background/50 to-background pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-primary text-xs font-bold mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              {pagination.totalCourses > 0 ? `${pagination.totalCourses}+ courses available` : 'Explore all courses'}
            </motion.div>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold text-foreground mb-4 leading-none">
              Browse <span className="text-gradient">Courses</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Expand your skills. Earn XP. Unlock certificates. Learn at your own pace.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.form onSubmit={handleSearch}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex gap-2 max-w-2xl mx-auto mb-6"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input ref={searchRef} type="text" placeholder="Search courses, skills, instructors…"
                value={filters.search} onChange={e => setFilter('search', e.target.value)}
                className="input-styled pl-11 w-full !h-12 !text-sm shadow-lg" />
            </div>
            <button type="submit" className="btn-primary !h-12 !px-6 !text-sm gap-2 shadow-lg shadow-primary/20 shrink-0">
              <Search className="h-4 w-4" /> Search
            </button>
            <button type="button" onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 !h-12 px-4 rounded-xl text-sm font-semibold border transition-all shrink-0 ${showFilters || hasActive ? 'border-primary/40 bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:bg-muted card-base'}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {hasActive && <span className="w-2 h-2 rounded-full bg-primary" />}
            </button>
          </motion.form>

          {/* Stat pills */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: BookOpen, label: `${pagination.totalCourses || 0}+ Courses`, color: 'text-primary bg-primary/8 border-primary/15' },
              { icon: GraduationCap, label: 'Expert Instructors', color: 'text-cyan-500 bg-cyan-500/8 border-cyan-500/15' },
              { icon: Star, label: '4.7★ Avg Rating', color: 'text-amber-500 bg-amber-500/8 border-amber-500/15' },
              { icon: Zap, label: 'Points System', color: 'text-emerald-500 bg-emerald-500/8 border-emerald-500/15' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════ CONTENT ══════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            {[{ id: '', name: 'All Categories' }, ...categories].map(cat => (
              <button key={cat.id} onClick={() => setFilter('category_id', String(cat.id))}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  String(filters.category_id) === String(cat.id)
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Advanced filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mb-6">
              <div className="card-base rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Filter Options</h3>
                  {hasActive && <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /> Clear all</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Level', key: 'difficulty_level', opts: [['', 'All Levels'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']] },
                    { label: 'Sort By', key: 'sort_by', opts: [['newest', 'Newest First'], ['rating', 'Highest Rated'], ['popular', 'Most Popular']] },
                    { label: 'Min Rating', key: 'min_rating', opts: [['', 'Any rating'], ['4.5', '4.5+ ⭐'], ['4.0', '4.0+ ⭐'], ['3.5', '3.5+ ⭐']] },
                  ].map(({ label, key, opts }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{label}</label>
                      <select value={filters[key]} onChange={e => setFilter(key, e.target.value)} className="input-styled text-sm w-full">
                        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Max Points</label>
                    <input type="number" value={filters.max_price} onChange={e => setFilter('max_price', e.target.value)} placeholder="No limit" min="0" className="input-styled text-sm w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><Tag className="h-3 w-3" /> Tags</label>
                    <TagFilter selectedTags={filters.tags} onChange={tags => setFilter('tags', tags)} />
                    {filters.tags.length > 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Match:</span>
                        {['or', 'and'].map(l => (
                          <button key={l} onClick={() => setFilter('tag_logic', l)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all ${filters.tag_logic === l ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                            {l === 'or' ? 'Any tag' : 'All tags'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results bar */}
        {!loading && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-bold text-foreground">{courses.length}</span> of <span className="font-bold text-foreground">{pagination.totalCourses}</span> courses
              {hasActive && <button onClick={clearFilters} className="ml-2 text-xs text-primary hover:underline font-medium">Clear filters</button>}
            </p>
            <div className="flex items-center gap-2">
              {/* Sort bar */}
              <div className="hidden sm:flex p-1 bg-muted rounded-lg border border-border gap-1">
                {[['newest','New'],['rating','Top Rated'],['popular','Popular']].map(([v, l]) => (
                  <button key={v} onClick={() => setFilter('sort_by', v)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filters.sort_by === v ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <div className="flex p-1 bg-muted rounded-lg border border-border gap-1">
                {[['grid', Grid3X3], ['list', List]].map(([v, Icon]) => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className={`p-1.5 rounded-md transition-all ${viewMode === v ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grid / List */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : courses.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-6 border border-border">
              <Target className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-black text-foreground mb-2">No courses found</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">Try different keywords or clear your filters to discover more courses.</p>
            <button onClick={clearFilters} className="btn-outline">Clear all filters</button>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <>
            <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {courses.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
              </AnimatePresence>
            </motion.div>
          </>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {courses.map((c, i) => <CourseListItem key={c.id} course={c} index={i} />)}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-12">
            <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {getPages().map(p => (
              <button key={p} onClick={() => handlePageChange(p)}
                className={`w-9 h-9 rounded-xl text-sm font-black border transition-all ${p === pagination.currentPage ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
