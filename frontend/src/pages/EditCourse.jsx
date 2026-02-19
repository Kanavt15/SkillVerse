import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Save, Eye, BookOpen, Plus, Edit, Trash2, MoveUp, MoveDown, Star, Trophy } from 'lucide-react';

const EditCourse = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    difficulty_level: 'beginner',
    points_cost: 50,
    points_reward: 75,
    is_published: false
  });

  const difficultyDefaults = {
    beginner: { cost: 50, reward: 75 },
    intermediate: { cost: 100, reward: 150 },
    advanced: { cost: 200, reward: 300 }
  };

  useEffect(() => {
    fetchCourse();
    fetchCategories();
    fetchLessons();
  }, [id]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}`);
      const course = response.data.course;
      setFormData({
        title: course.title,
        description: course.description,
        category_id: course.category_id,
        difficulty_level: course.difficulty_level,
        points_cost: course.points_cost ?? 50,
        points_reward: course.points_reward ?? 75,
        is_published: course.is_published
      });
    } catch (error) {
      toast.error('Error', 'Failed to load course details');
      navigate('/instructor/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchLessons = async () => {
    try {
      const response = await api.get(`/lessons/course/${id}`);
      setLessons(response.data.lessons || []);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put(`/courses/${id}`, formData);
      toast.success('Success!', 'Course updated successfully');
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
    setFormData(prev => {
      const updated = { ...prev, [e.target.name]: value };
      if (e.target.name === 'difficulty_level') {
        const defaults = difficultyDefaults[value] || difficultyDefaults.beginner;
        updated.points_cost = defaults.cost;
        updated.points_reward = defaults.reward;
      }
      return updated;
    });
  };

  const handleTogglePublish = async () => {
    if (!formData.is_published && lessons.length === 0) {
      toast.warning('Cannot Publish', 'Add at least one lesson before publishing the course');
      return;
    }

    setSaving(true);
    try {
      const newStatus = !formData.is_published;
      await api.put(`/courses/${id}`, { is_published: newStatus });
      setFormData({ ...formData, is_published: newStatus });
      toast.success(
        'Success!',
        newStatus ? 'Course published successfully!' : 'Course unpublished successfully'
      );
    } catch (error) {
      toast.error('Error', 'Failed to update course status');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) {
      return;
    }

    try {
      await api.delete(`/lessons/${lessonId}`);
      setLessons(lessons.filter((lesson) => lesson.id !== lessonId));
      toast.success('Success!', 'Lesson deleted successfully');
    } catch (error) {
      toast.error('Error', 'Failed to delete lesson');
    }
  };

  const handleReorderLesson = async (lessonId, direction) => {
    const currentIndex = lessons.findIndex(l => l.id === lessonId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= lessons.length) return;

    const newLessons = [...lessons];
    [newLessons[currentIndex], newLessons[newIndex]] = [newLessons[newIndex], newLessons[currentIndex]];

    // Update lesson_order for both lessons
    try {
      await Promise.all([
        api.put(`/lessons/${newLessons[currentIndex].id}`, { lesson_order: currentIndex + 1 }),
        api.put(`/lessons/${newLessons[newIndex].id}`, { lesson_order: newIndex + 1 })
      ]);

      setLessons(newLessons);
      toast.success('Success!', 'Lesson order updated');
    } catch (error) {
      toast.error('Error', 'Failed to reorder lessons');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading course...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/instructor/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Edit Course</h1>
              <p className="text-slate-400 mt-1">Manage your course content and lessons</p>
            </div>
          </div>
          <Badge variant={formData.is_published ? 'default' : 'secondary'} className="text-sm">
            {formData.is_published ? 'Published' : 'Draft'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Details Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Course Information</CardTitle>
                <CardDescription>Update your course details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Course Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="e.g., Complete Web Development Bootcamp"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe what students will learn in this course"
                      rows={5}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category_id">Category *</Label>
                      <select
                        id="category_id"
                        name="category_id"
                        value={formData.category_id}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="" className="bg-[#111827] text-white">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id} className="bg-[#111827] text-white">
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="difficulty_level">Difficulty Level *</Label>
                      <select
                        id="difficulty_level"
                        name="difficulty_level"
                        value={formData.difficulty_level}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="points_cost">Enrollment Cost (pts)</Label>
                        <Input
                          id="points_cost"
                          name="points_cost"
                          type="number"
                          min="0"
                          value={formData.points_cost}
                          onChange={handleChange}
                        />
                        <p className="text-xs text-amber-400/70">Set to 0 for free courses</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="points_reward">Completion Reward (pts)</Label>
                        <Input
                          id="points_reward"
                          name="points_reward"
                          type="number"
                          min="0"
                          value={formData.points_reward}
                          onChange={handleChange}
                        />
                        <p className="text-xs text-amber-400/70">Points students earn on completion</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      type="button"
                      variant={formData.is_published ? 'outline' : 'default'}
                      onClick={handleTogglePublish}
                      disabled={saving}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {formData.is_published ? 'Unpublish' : 'Publish Course'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Lessons Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Course Lessons
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                    </CardDescription>
                  </div>
                  <Link to={`/instructor/courses/${id}/lessons/create`}>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {lessons.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm mb-4">No lessons yet</p>
                    <Link to={`/instructor/courses/${id}/lessons/create`}>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Lesson
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="p-3 border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-500">
                                Lesson {index + 1}
                              </span>
                              {lesson.is_free && (
                                <Badge variant="secondary" className="text-xs">Free</Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-white truncate">
                              {lesson.title}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleReorderLesson(lesson.id, 'up')}
                                disabled={index === 0}
                              >
                                <MoveUp className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleReorderLesson(lesson.id, 'down')}
                                disabled={index === lessons.length - 1}
                              >
                                <MoveDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex gap-1">
                              <Link to={`/instructor/courses/${id}/lessons/${lesson.id}/edit`}>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteLesson(lesson.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditCourse;
