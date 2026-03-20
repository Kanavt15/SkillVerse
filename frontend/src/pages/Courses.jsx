import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Search, Filter, Star, Users, BookOpen, Loader2, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Button } from '../components/ui/button';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0 });
  const [filters, setFilters] = useState({
    category_id: '',
    difficulty_level: '',
    search: '',
    sort_by: 'newest'
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchCourses(1);
  }, [filters.category_id, filters.difficulty_level, filters.sort_by]);

  const fetchCourses = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 12 };
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.difficulty_level) params.difficulty_level = filters.difficulty_level;
      if (filters.search) params.search = filters.search;
      if (filters.sort_by) params.sort_by = filters.sort_by;

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
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCourses(1);
  };

  const handlePageChange = (page) => {
    fetchCourses(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'intermediate': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'advanced': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-muted-foreground text-opacity-80 border-slate-500/20';
    }
  };

  const getPointsCost = (course) => {
    return course.points_cost ?? course.price ?? 0;
  };

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
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-3 w-3 ${star <= Math.round(r)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-muted-foreground text-opacity-40'
                }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground text-opacity-80 ml-0.5">{r.toFixed(1)}</span>
      </div>
    );
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const { currentPage, totalPages } = pagination;
    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <div className="mb-12 border-b border-border/50 pb-8">
        <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">Browse Courses</h1>
        <p className="text-lg text-muted-foreground text-opacity-90">Discover courses and spend points to learn new skills</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 mb-12 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground text-opacity-80" />
            <input
              type="text"
              placeholder="Search courses..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground transition-all duration-300"
            />
          </div>
          <select
            value={filters.category_id}
            onChange={(e) => { setFilters({ ...filters, category_id: e.target.value }); }}
            className="px-4 py-2.5 border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 cursor-pointer hover:bg-blue-50/50"
          >
            <option value="" className="bg-card text-foreground">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="bg-card text-foreground">{cat.name}</option>
            ))}
          </select>
          <select
            value={filters.difficulty_level}
            onChange={(e) => { setFilters({ ...filters, difficulty_level: e.target.value }); }}
            className="px-4 py-2.5 border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 cursor-pointer hover:bg-blue-50/50"
          >
            <option value="" className="bg-card text-foreground">All Levels</option>
            <option value="beginner" className="bg-card text-foreground">Beginner</option>
            <option value="intermediate" className="bg-card text-foreground">Intermediate</option>
            <option value="advanced" className="bg-card text-foreground">Advanced</option>
          </select>
          <select
            value={filters.sort_by}
            onChange={(e) => { setFilters({ ...filters, sort_by: e.target.value }); }}
            className="px-4 py-2.5 border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 cursor-pointer hover:bg-blue-50/50"
          >
            <option value="newest" className="bg-card text-foreground">Newest</option>
            <option value="rating" className="bg-card text-foreground">Highest Rated</option>
            <option value="popular" className="bg-card text-foreground">Most Popular</option>
          </select>
          <Button type="submit" className="shrink-0">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </form>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-16 w-16 text-muted-foreground text-opacity-40 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground text-opacity-80 mb-2">No courses found</h3>
          <p className="text-muted-foreground text-opacity-60">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <Link key={course.id} to={`/courses/${course.id}`} className="group">
                <div className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 h-full flex flex-col shadow-sm hover:shadow-md hover:shadow-blue-900/5">
                  <div className="aspect-video bg-blue-50/50 overflow-hidden relative">
                    {course.thumbnail ? (
                      <img
                        src={getThumbnailUrl(course.thumbnail)}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-900/20 to-indigo-900/20">
                        <BookOpen className="h-12 w-12 text-cyan-700" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${getDifficultyColor(course.difficulty_level)}`}>
                        {course.difficulty_level}
                      </span>
                      {course.category_name && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 font-medium">
                          {course.category_name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-sm text-muted-foreground text-opacity-80 mb-4 line-clamp-2 flex-1">
                      {course.description}
                    </p>

                    {/* Rating */}
                    <div className="mb-3">
                      {renderStars(course.avg_rating)}
                      {(course.review_count > 0) && (
                        <span className="text-xs text-muted-foreground text-opacity-60 ml-1">({course.review_count})</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-bold text-amber-600">
                          {getPointsCost(course) === 0 ? 'Free' : `${getPointsCost(course)} pts`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground text-opacity-60">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {course.lesson_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {course.enrollment_count || 0}
                        </span>
                      </div>
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
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-zinc-50 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === pagination.currentPage
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'border border-border text-muted-foreground hover:text-foreground hover:bg-zinc-50 shadow-sm'
                    }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-zinc-50 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
