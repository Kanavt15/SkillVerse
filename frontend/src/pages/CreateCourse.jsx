import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';
import { ArrowLeft, Upload, Loader2, Star, Trophy } from 'lucide-react';

const CreateCourse = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    difficulty_level: 'beginner',
    points_cost: 50,
    points_reward: 75
  });
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const difficultyDefaults = {
    beginner: { cost: 50, reward: 75 },
    intermediate: { cost: 100, reward: 150 },
    advanced: { cost: 200, reward: 300 }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Auto-update points when difficulty changes
      if (name === 'difficulty_level') {
        const defaults = difficultyDefaults[value] || difficultyDefaults.beginner;
        updated.points_cost = defaults.cost;
        updated.points_reward = defaults.reward;
      }
      return updated;
    });
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnail(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      showToast('Title and description are required', 'error');
      return;
    }

    try {
      setLoading(true);
      const data = new FormData();
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('difficulty_level', formData.difficulty_level);
      data.append('points_cost', formData.points_cost);
      data.append('points_reward', formData.points_reward);
      if (formData.category_id) data.append('category_id', formData.category_id);
      if (thumbnail) data.append('thumbnail', thumbnail);

      const response = await api.post('/courses', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('Course created successfully!', 'success');
      navigate(`/instructor/courses/${response.data.course.id}/edit`);
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating course', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-sm text-slate-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-white mb-8">Create New Course</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Course Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Introduction to Web Development"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows={4}
            className="w-full px-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500"
            placeholder="Describe what students will learn..."
          />
        </div>

        {/* Category & Difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500"
            >
              <option value="" className="bg-[#111827] text-white">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-[#111827] text-white">{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Difficulty Level</label>
            <select
              name="difficulty_level"
              value={formData.difficulty_level}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500"
            >
              <option value="beginner" className="bg-[#111827] text-white">Beginner</option>
              <option value="intermediate" className="bg-[#111827] text-white">Intermediate</option>
              <option value="advanced" className="bg-[#111827] text-white">Advanced</option>
            </select>
          </div>
        </div>

        {/* Points Settings */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Points Settings
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Enrollment Cost (pts)
              </label>
              <input
                type="number"
                name="points_cost"
                value={formData.points_cost}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2.5 border border-amber-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white/[0.05] text-white"
              />
              <p className="text-xs text-amber-400/70 mt-1">Set to 0 for free courses</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-400 mb-1">
                Completion Reward (pts)
              </label>
              <input
                type="number"
                name="points_reward"
                value={formData.points_reward}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2.5 border border-amber-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white/[0.05] text-white"
              />
              <p className="text-xs text-amber-400/70 mt-1">Points earned when students complete the course</p>
            </div>
          </div>
        </div>

        {/* Thumbnail */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Course Thumbnail</label>
          <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-6 text-center hover:border-cyan-500/30 transition-colors">
            {thumbnailPreview ? (
              <div className="relative">
                <img src={thumbnailPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                <button
                  type="button"
                  onClick={() => { setThumbnail(null); setThumbnailPreview(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Click to upload thumbnail</p>
                <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WebP • Max 5MB</p>
                <input
                  type="file"
                  onChange={handleThumbnailChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full py-6 text-lg rounded-xl">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : null}
          Create Course
        </Button>
      </form>
    </div>
  );
};

export default CreateCourse;
