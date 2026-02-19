import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

const EditLesson = () => {
  const { id: courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    video_url: '',
    duration_minutes: 0,
    is_free: false
  });

  useEffect(() => {
    fetchLesson();
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const response = await api.get(`/lessons/${lessonId}`);
      const lesson = response.data.lesson;
      setFormData({
        title: lesson.title,
        content: lesson.content,
        video_url: lesson.video_url || '',
        duration_minutes: lesson.duration_minutes,
        is_free: lesson.is_free
      });
    } catch (error) {
      toast.error('Error', 'Failed to load lesson details');
      navigate(`/instructor/courses/${courseId}/edit`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put(`/lessons/${lessonId}`, formData);
      toast.success('Success!', 'Lesson updated successfully');
      navigate(`/instructor/courses/${courseId}/edit`);
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to update lesson');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.type === 'number'
        ? parseInt(e.target.value)
        : e.target.value;

    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading lesson...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/instructor/courses/${courseId}/edit`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Edit Lesson</CardTitle>
            <CardDescription>Update lesson content and details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Lesson Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Introduction to Variables"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Lesson Content *</Label>
                <Textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder="Write your lesson content here. You can include text, code examples, explanations, etc."
                  rows={10}
                  required
                />
                <p className="text-sm text-slate-500">
                  Provide detailed explanation and instructions for this lesson
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video_url">Video URL (Optional)</Label>
                <Input
                  id="video_url"
                  name="video_url"
                  type="url"
                  value={formData.video_url}
                  onChange={handleChange}
                  placeholder="https://youtube.com/watch?v=..."
                />
                <p className="text-sm text-slate-500">
                  Add a YouTube, Vimeo, or other video URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="0"
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  placeholder="30"
                />
                <p className="text-sm text-slate-500">
                  Estimated time to complete this lesson
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_free"
                  name="is_free"
                  checked={formData.is_free}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-white/[0.15]"
                />
                <Label htmlFor="is_free" className="font-normal cursor-pointer">
                  Make this lesson free (preview)
                </Label>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/instructor/courses/${courseId}/edit`)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditLesson;
