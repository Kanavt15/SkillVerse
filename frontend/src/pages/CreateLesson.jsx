import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Upload, X, Video, Link as LinkIcon } from 'lucide-react';

const CreateLesson = () => {
  const { id } = useParams(); // course ID
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoType, setVideoType] = useState('url'); // 'url' or 'file'
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    video_url: '',
    duration_minutes: 0,
    is_free: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get next lesson order
      const lessonsRes = await api.get(`/lessons/course/${id}`);
      const nextOrder = (lessonsRes.data.lessons?.length || 0) + 1;

      const data = new FormData();
      data.append('title', formData.title);
      data.append('description', formData.description || '');
      data.append('content', formData.content);
      data.append('lesson_order', nextOrder);
      data.append('duration_minutes', formData.duration_minutes || 0);
      data.append('is_free', formData.is_free);
      
      if (videoType === 'file' && videoFile) {
        data.append('video', videoFile);
      } else if (videoType === 'url' && formData.video_url) {
        data.append('video_url', formData.video_url);
      }

      await api.post(`/courses/${id}/lessons`, data, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      toast.success('Success!', 'Lesson created successfully');
      navigate(`/instructor/courses/${id}/edit`);
    } catch (error) {
      toast.error('Error', error.response?.data?.message || 'Failed to create lesson');
    } finally {
      setLoading(false);
      setUploadProgress(0);
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

  const handleVideoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error('File too large', 'Video must be less than 500MB');
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/instructor/courses/${id}/edit`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Create New Lesson</CardTitle>
            <CardDescription>Add a new lesson to your course</CardDescription>
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
                <Label htmlFor="description">Short Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Brief overview of what students will learn in this lesson"
                  rows={2}
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
                <p className="text-sm text-gray-600">
                  Provide detailed explanation and instructions for this lesson
                </p>
              </div>

              <div className="space-y-2">
                <Label>Video Content</Label>
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    variant={videoType === 'url' ? 'default' : 'outline'}
                    onClick={() => setVideoType('url')}
                    className="flex-1"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Video URL
                  </Button>
                  <Button
                    type="button"
                    variant={videoType === 'file' ? 'default' : 'outline'}
                    onClick={() => setVideoType('file')}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Video
                  </Button>
                </div>

                {videoType === 'url' ? (
                  <div className="space-y-2">
                    <Input
                      id="video_url"
                      name="video_url"
                      type="url"
                      value={formData.video_url}
                      onChange={handleChange}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                    <p className="text-sm text-gray-600">
                      Add a YouTube, Vimeo, or other video URL
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {videoPreview ? (
                      <div className="relative">
                        <video
                          src={videoPreview}
                          controls
                          className="w-full h-64 rounded-lg bg-black"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={removeVideo}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                        onClick={() => document.getElementById('video_file').click()}
                      >
                        <Video className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-1">Click to upload video</p>
                        <p className="text-xs text-gray-500">MP4, AVI, MOV up to 500MB</p>
                        <Input
                          id="video_file"
                          type="file"
                          accept="video/*"
                          onChange={handleVideoFileChange}
                          className="hidden"
                        />
                      </div>
                    )}
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                <p className="text-sm text-gray-600">
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
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_free" className="font-normal cursor-pointer">
                  Make this lesson free (preview)
                </Label>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Lesson'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/instructor/courses/${id}/edit`)}
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

export default CreateLesson;
