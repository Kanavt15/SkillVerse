import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Search, Filter, Star, Users, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category_id: '',
    difficulty_level: '',
    search: ''
  });

  useEffect(() => {
    fetchCourses();
    fetchCategories();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.difficulty_level) params.difficulty_level = filters.difficulty_level;
      if (filters.search) params.search = filters.search;

      const response = await api.get('/courses', { params });
      setCourses(response.data.courses);
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
    fetchCourses();
  };

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'intermediate': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'advanced': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getPointsCost = (course) => {
    const cost = course.points_cost ?? course.price ?? 0;
    return cost;
  };

  const getThumbnailUrl = (thumbnail) => {
    if (!thumbnail) return null;
    if (thumbnail.startsWith('http')) return thumbnail;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${baseUrl}${thumbnail}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Browse Courses</h1>
        <p className="text-slate-400">Discover courses and spend points to learn new skills</p>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search courses..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:text-slate-500"
            />
          </div>
          <select
            value={filters.category_id}
            onChange={(e) => { setFilters({ ...filters, category_id: e.target.value }); }}
            className="px-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="" className="bg-[#111827] text-white">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="bg-[#111827] text-white">{cat.name}</option>
            ))}
          </select>
          <select
            value={filters.difficulty_level}
            onChange={(e) => { setFilters({ ...filters, difficulty_level: e.target.value }); }}
            className="px-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="" className="bg-[#111827] text-white">All Levels</option>
            <option value="beginner" className="bg-[#111827] text-white">Beginner</option>
            <option value="intermediate" className="bg-[#111827] text-white">Intermediate</option>
            <option value="advanced" className="bg-[#111827] text-white">Advanced</option>
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
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-400 mb-2">No courses found</h3>
          <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => (
            <Link key={course.id} to={`/courses/${course.id}`} className="group">
              <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden hover:border-cyan-500/20 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                <div className="aspect-video bg-white/[0.03] overflow-hidden">
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
                      <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {course.category_name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2 flex-1">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-bold text-amber-400">
                        {getPointsCost(course) === 0 ? 'Free' : `${getPointsCost(course)} pts`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
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
      )}
    </div>
  );
};

export default Courses;
