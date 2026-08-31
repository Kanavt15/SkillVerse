import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import {
  Search, Star, Users, BookOpen, Loader2,
  ChevronLeft, ChevronRight, SlidersHorizontal, X,
  Filter, Clock, GraduationCap, TrendingUp
} from 'lucide-react';
import TagFilter from '../components/TagFilter';

/* ── Skeleton card ── */
const SkeletonCard = () => (
  <div className="card-base rounded-2xl overflow-hidden">
    <div className="aspect-video skeleton" />
    <div className="p-5 space-y-3">
      <div className="flex gap-2">
        <div className="h-5 w-20 skeleton rounded-full" />
        <div className="h-5 w-16 skeleton rounded-full" />
      </div>
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

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category_id: '',
    difficulty_level: '',
    search: '',
    sort_by: 'newest',
    tags: [],
    tag_logic: 'or',
    min_rating: '',
    max_price: '',
    min_duration: '',
    max_duration: '',
  });

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
      const response = await api.get('/courses', { params });
      setCourses(response.data.courses);
      setPagination(response.data.pagination || { currentPage: page, totalPages: 1, totalCourses: response.data.count });
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) { console.error('Error fetching categories:', error); }
  };

  const handleSearch = (e) => { e.preventDefault(); fetchCourses(1); };
  const handlePageChange = (page) => { fetchCourses(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const clearFilters = () => setFilters({
    category_id: '', difficulty_level: '', search: '', sort_by: 'newest',
    tags: [], tag_logic: 'or', min_rating: '', max_price: '', min_duration: '', max_duration: '',
  });

  const hasActiveFilters = filters.search || filters.tags.length > 0 || filters.min_rating ||
    filters.max_price || filters.category_id || filters.difficulty_level;

  const difficultyConfig = {
    beginner: { cls: 'badge-emerald', label: 'Beginner' },
    intermediate: { cls: 'badge-amber', label: 'Intermediate' },
    advanced: { cls: 'badge-red', label: 'Advanced' },
  };

  const getPointsCost = (course) => course.points_cost ?? course.price ?? 0;

  const getThumbnailUrl = (thumbnail) => {
    if (!thumbnail) return null;
    if (thumbnail.startsWith('http')) return thumbnail;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${baseUrl}${thumbnail}`;
  };

  const renderStars = (rating) => {
    const r = parseFloat(rating) || 0;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <Star key={s} className={`h-3 w-3 ${s <= Math.round(r) ? 'text-amber-400 fill-amber-400' : 'text-muted'}`} />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{r > 0 ? r.toFixed(1) : 'No ratings'}</span>
      </div>
    );
  };

  const getPageNumbers = () => {
    const { currentPage, totalPages } = pagination;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Page Header ── */}
        <div className="mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-4xl md:text-5xl font-bold text-foreground mb-3"
          >
            Browse <span className="text-gradient">Courses</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Discover {pagination.totalCourses > 0 ? `${pagination.totalCourses}+` : ''} courses and spend points to unlock new skills.
          </motion.p>
        </div>

        {/* ── Search + Quick Filters Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="card-base rounded-2xl p-4 mb-6"
        >
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search courses, topics, instructors..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-styled pl-10 w-full"
              />
            </div>

            <select
              value={filters.sort_by}
              onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
              className="input-styled text-sm max-w-[160px]"
            >
              <option value="newest">Newest first</option>
              <option value="rating">Highest rated</option>
              <option value="popular">Most popular</option>
            </select>

            <button type="submit" className="btn-primary text-sm !py-2.5 !px-5 shrink-0">
              <Search className="h-4 w-4" />
              Search
            </button>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all shrink-0 ${
                showFilters || hasActiveFilters
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          </form>
        </motion.div>

        {/* ── Advanced Filters Panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden mb-6"
            >
              <div className="card-base rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" /> Filter Options
                  </h3>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" /> Clear all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Category</label>
                    <select
                      value={filters.category_id}
                      onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                      className="input-styled text-sm w-full"
                    >
                      <option value="">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Level</label>
                    <select
                      value={filters.difficulty_level}
                      onChange={(e) => setFilters({ ...filters, difficulty_level: e.target.value })}
                      className="input-styled text-sm w-full"
                    >
                      <option value="">All Levels</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Min Rating</label>
                    <select
                      value={filters.min_rating}
                      onChange={(e) => setFilters({ ...filters, min_rating: e.target.value })}
                      className="input-styled text-sm w-full"
                    >
                      <option value="">Any rating</option>
                      <option value="4.5">4.5+ ⭐</option>
                      <option value="4.0">4.0+ ⭐</option>
                      <option value="3.5">3.5+ ⭐</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Max Points</label>
                    <input
                      type="number"
                      value={filters.max_price}
                      onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                      placeholder="No limit"
                      min="0"
                      className="input-styled text-sm w-full"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</label>
                    <TagFilter selectedTags={filters.tags} onChange={(tags) => setFilters({ ...filters, tags })} />
                    {filters.tags.length > 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Match:</span>
                        {['or', 'and'].map(logic => (
                          <button
                            key={logic}
                            onClick={() => setFilters({ ...filters, tag_logic: logic })}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
                              filters.tag_logic === logic
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            {logic === 'or' ? 'Any tag' : 'All tags'}
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

        {/* ── Results Info ── */}
        {!loading && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-foreground">{courses.length}</span>
              {' '}of{' '}
              <span className="font-semibold text-foreground">{pagination.totalCourses}</span>
              {' '}courses
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Course Grid ── */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5 border border-border">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No courses found</h3>
            <p className="text-muted-foreground text-sm mb-6">Try adjusting your search or clearing your filters</p>
            <button onClick={clearFilters} className="btn-outline text-sm">Clear all filters</button>
          </motion.div>
        ) : (
          <>
            <motion.div
              layout
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              <AnimatePresence mode="popLayout">
                {courses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  >
                    <Link to={`/courses/${course.id}`} className="group block h-full">
                      <div className="h-full flex flex-col card-base rounded-2xl overflow-hidden card-hover">
                        {/* Thumbnail */}
                        <div className="aspect-video overflow-hidden relative bg-gradient-to-br from-muted to-muted/50">
                          {course.thumbnail ? (
                            <img
                              src={getThumbnailUrl(course.thumbnail)}
                              alt={course.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                          )}
                          {/* Points badge */}
                          <div className="absolute top-3 right-3">
                            <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2.5 py-1 border border-border shadow-sm">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              <span className="text-xs font-bold text-foreground">
                                {getPointsCost(course) === 0 ? 'Free' : `${getPointsCost(course)} pts`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 flex-1 flex flex-col">
                          {/* Chips */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {course.difficulty_level && (
                              <span className={difficultyConfig[course.difficulty_level]?.cls || 'badge-teal'}>
                                {difficultyConfig[course.difficulty_level]?.label || course.difficulty_level}
                              </span>
                            )}
                            {course.category_name && (
                              <span className="badge-teal">{course.category_name}</span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {course.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 flex-1 leading-relaxed">
                            {course.description}
                          </p>

                          {/* Rating */}
                          <div className="mb-3">{renderStars(course.avg_rating)}</div>

                          {/* Instructor */}
                          {course.instructor_name && (
                            <p className="text-xs text-muted-foreground mb-3">by <span className="font-medium text-foreground">{course.instructor_name}</span></p>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              {course.lesson_count || 0} lessons
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {(course.enrollment_count || 0).toLocaleString()} enrolled
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-9 h-9 rounded-xl text-sm font-semibold border transition-all ${
                      page === pagination.currentPage
                        ? 'bg-primary text-primary-foreground border-primary shadow-teal'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Courses;
