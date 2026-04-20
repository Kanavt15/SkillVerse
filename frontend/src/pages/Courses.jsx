import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import {
  Search, Filter, Star, Users, BookOpen, Loader2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, SlidersHorizontal, X
} from 'lucide-react';
import TagFilter from '../components/TagFilter';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0 });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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

  const hasActiveFilters = filters.search || filters.tags.length > 0 || filters.min_rating || filters.max_price || filters.category_id || filters.difficulty_level;

  const getDifficultyBadge = (level) => {
    const map = {
      beginner: 'badge-emerald',
      intermediate: 'badge-gold',
      advanced: 'badge-red',
    };
    return map[level] || 'badge-violet';
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
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={`h-3 w-3 ${star <= Math.round(r) ? 'text-amber-400 fill-amber-400' : 'text-white/15'}`} />
        ))}
        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">{r.toFixed(1)}</span>
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

  const selectClass = "input-styled text-sm cursor-pointer";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
          Browse <span className="text-gradient">Courses</span>
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-lg">
          Discover courses and spend points to unlock new skills.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="glass-card rounded-2xl p-5 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search courses..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-styled pl-10"
            />
          </div>
          <select
            value={filters.category_id}
            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
            className={selectClass}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={filters.difficulty_level}
            onChange={(e) => setFilters({ ...filters, difficulty_level: e.target.value })}
            className={selectClass}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            value={filters.sort_by}
            onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
            className={selectClass}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value="newest">Newest</option>
            <option value="rating">Highest Rated</option>
            <option value="popular">Most Popular</option>
          </select>
          <button type="submit" className="btn-primary flex items-center gap-2 shrink-0 !py-2.5 !px-5 text-sm">
            <Filter className="h-4 w-4" />
            Search
          </button>
        </form>
      </div>

      {/* Results bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-3">
          {loading ? 'Loading...' : (
            <>
              <span>
                Showing <strong className="text-white">{courses.length}</strong> of <strong className="text-white">{pagination.totalCourses}</strong> courses
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs font-medium"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-white border border-white/8 hover:border-violet-500/30 rounded-lg bg-white/3 transition-all"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Advanced
          {showAdvancedFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="mb-8 p-5 glass-card rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">Advanced Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Tags</label>
              <TagFilter selectedTags={filters.tags} onChange={(tags) => setFilters({ ...filters, tags })} />
              {filters.tags.length > 1 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Match:</span>
                  {['or', 'and'].map(logic => (
                    <button
                      key={logic}
                      onClick={() => setFilters({ ...filters, tag_logic: logic })}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                        filters.tag_logic === logic
                          ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                          : 'border border-white/10 text-[hsl(var(--muted-foreground))] hover:border-white/20'
                      }`}
                    >
                      {logic === 'or' ? 'Any' : 'All'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Min Rating</label>
              <select
                value={filters.min_rating}
                onChange={(e) => setFilters({ ...filters, min_rating: e.target.value })}
                className="input-styled text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="">Any Rating</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="4.0">4.0+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
                <option value="3.0">3.0+ Stars</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Max Price (Points)</label>
              <input
                type="number"
                value={filters.max_price}
                onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                placeholder="No limit"
                min="0"
                className="input-styled text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Min Duration (hrs)</label>
              <input
                type="number"
                value={filters.min_duration}
                onChange={(e) => setFilters({ ...filters, min_duration: e.target.value })}
                placeholder="Min hours"
                min="0" step="0.5"
                className="input-styled text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Max Duration (hrs)</label>
              <input
                type="number"
                value={filters.max_duration}
                onChange={(e) => setFilters({ ...filters, max_duration: e.target.value })}
                placeholder="Max hours"
                min="0" step="0.5"
                className="input-styled text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Course Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-28">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-400 mx-auto mb-4" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading courses...</p>
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-28">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-5">
            <BookOpen className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No courses found</h3>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map(course => (
              <Link key={course.id} to={`/courses/${course.id}`} className="group">
                <div className="h-full flex flex-col rounded-2xl border border-white/6 bg-white/[0.025] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/25 hover:shadow-xl hover:shadow-black/30">
                  {/* Thumbnail */}
                  <div className="aspect-video overflow-hidden relative bg-gradient-to-br from-violet-900/30 to-indigo-900/20">
                    {course.thumbnail ? (
                      <img
                        src={getThumbnailUrl(course.thumbnail)}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-violet-500/40" />
                      </div>
                    )}
                    {/* Points overlay */}
                    <div className="absolute top-3 right-3">
                      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold text-amber-300">
                          {getPointsCost(course) === 0 ? 'Free' : `${getPointsCost(course)} pts`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    {/* Tags & difficulty */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className={getDifficultyBadge(course.difficulty_level)}>
                        {course.difficulty_level}
                      </span>
                      {course.category_name && (
                        <span className="badge-violet">{course.category_name}</span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 group-hover:text-violet-300 transition-colors line-clamp-2 leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 line-clamp-2 flex-1 leading-relaxed">
                      {course.description}
                    </p>

                    {/* Rating */}
                    <div className="mb-3">{renderStars(course.avg_rating)}</div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/6 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.lesson_count || 0} lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.enrollment_count || 0} enrolled
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="p-2 rounded-lg border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    page === pagination.currentPage
                      ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300 glow-violet-sm'
                      : 'border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-white/20'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-2 rounded-lg border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Courses;
