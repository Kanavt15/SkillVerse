import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/button';
import {
    MessageSquare, ThumbsUp, Send, Edit2, Trash2, Loader2,
    ChevronDown, ChevronUp, Shield, Reply, Clock, AlertCircle
} from 'lucide-react';

// ─── Relative time helper ────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── Single reply card ───────────────────────────────────────────────────────
const ReplyCard = ({ reply, userId, onVote, onEdit, onDelete }) => {
    const isOwn = reply.user_id === userId;
    const initial = reply.full_name?.charAt(0)?.toUpperCase() || '?';

    return (
        <div className={`pl-4 border-l-2 ${reply.is_instructor_reply ? 'border-cyan-500/40' : 'border-border'}`}>
            <div className="p-3 rounded-lg bg-card border border-border shadow-sm">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${reply.is_instructor_reply ? 'bg-cyan-500/20' : 'bg-card border border-border shadow-sm'
                            }`}>
                            <span className={`font-bold text-xs ${reply.is_instructor_reply ? 'text-cyan-400' : 'text-muted-foreground text-opacity-80'}`}>
                                {initial}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">{reply.full_name}</span>
                            {reply.is_instructor_reply && (
                                <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                                    <Shield className="h-2.5 w-2.5" /> Instructor
                                </span>
                            )}
                            {isOwn && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">You</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground text-opacity-40">{timeAgo(reply.created_at)}</span>
                        {isOwn && (
                            <>
                                <button onClick={() => onEdit(reply)} className="p-1 rounded text-muted-foreground text-opacity-60 hover:text-cyan-400 transition-colors" title="Edit">
                                    <Edit2 className="h-3 w-3" />
                                </button>
                                <button onClick={() => onDelete(reply.id)} className="p-1 rounded text-muted-foreground text-opacity-60 hover:text-red-400 transition-colors" title="Delete">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                <div className="mt-2">
                    <button
                        onClick={() => onVote(reply.id)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${reply.user_has_voted
                            ? 'bg-cyan-500/15 text-cyan-400'
                            : 'text-muted-foreground text-opacity-60 hover:text-muted-foreground hover:bg-card border border-border shadow-sm'
                            }`}
                    >
                        <ThumbsUp className={`h-3 w-3 ${reply.user_has_voted ? 'fill-cyan-400' : ''}`} />
                        {reply.upvote_count > 0 && reply.upvote_count}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Single discussion post card ─────────────────────────────────────────────
const PostCard = ({ post, userId, isAuthenticated, onVote, onReply, onEdit, onDelete, onLoadReplies, showToast }) => {
    const isOwn = post.user_id === userId;
    const initial = post.full_name?.charAt(0)?.toUpperCase() || '?';
    const [replyContent, setReplyContent] = useState('');
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [submittingReply, setSubmittingReply] = useState(false);
    const [showAllReplies, setShowAllReplies] = useState(false);
    const [allReplies, setAllReplies] = useState([]);
    const [repliesPage, setRepliesPage] = useState(1);
    const [repliesTotalPages, setRepliesTotalPages] = useState(1);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [editingReply, setEditingReply] = useState(null);
    const [editContent, setEditContent] = useState('');

    const displayedReplies = showAllReplies ? allReplies : (post.latest_replies || []);

    const handleSubmitReply = async () => {
        if (!replyContent.trim()) return;
        try {
            setSubmittingReply(true);
            await onReply(post.course_id, replyContent.trim(), post.id);
            setReplyContent('');
            setShowReplyInput(false);
            // If replies are expanded, refresh them
            if (showAllReplies) {
                await loadAllReplies(1);
            }
        } catch {
            // error handled in parent
        } finally {
            setSubmittingReply(false);
        }
    };

    const loadAllReplies = async (page = 1) => {
        try {
            setLoadingReplies(true);
            const res = await api.get(`/discussions/${post.id}/replies`, { params: { page, limit: 10 } });
            if (page === 1) {
                setAllReplies(res.data.replies);
            } else {
                setAllReplies(prev => [...prev, ...res.data.replies]);
            }
            setRepliesPage(page);
            setRepliesTotalPages(res.data.pagination.totalPages);
            setShowAllReplies(true);
        } catch {
            showToast('Error loading replies', 'error');
        } finally {
            setLoadingReplies(false);
        }
    };

    const handleEditReply = (reply) => {
        setEditingReply(reply.id);
        setEditContent(reply.content);
    };

    const handleSaveEditReply = async (replyId) => {
        if (!editContent.trim()) return;
        try {
            await api.put(`/discussions/${replyId}`, { content: editContent.trim() });
            showToast('Reply updated', 'success');
            setEditingReply(null);
            setEditContent('');
            if (showAllReplies) {
                await loadAllReplies(1);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Error updating reply', 'error');
        }
    };

    const handleDeleteReply = async (replyId) => {
        if (!window.confirm('Delete this reply?')) return;
        try {
            await onDelete(replyId);
            if (showAllReplies) {
                await loadAllReplies(1);
            }
        } catch {
            // handled in parent
        }
    };

    const hiddenReplyCount = (post.reply_count || 0) - (post.latest_replies?.length || 0);

    return (
        <div className={`rounded-xl border transition-colors ${post.is_instructor_reply
            ? 'bg-cyan-500/[0.03] border-cyan-500/20'
            : 'bg-card border border-border shadow-sm border-border'
            }`}>
            {/* Post header + body */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${post.is_instructor_reply ? 'bg-cyan-500/20' : 'bg-card border border-border shadow-sm'
                            }`}>
                            <span className={`font-bold text-sm ${post.is_instructor_reply ? 'text-cyan-400' : 'text-muted-foreground text-opacity-80'}`}>
                                {initial}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground text-sm">{post.full_name}</span>
                                {post.is_instructor_reply && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                                        <Shield className="h-3 w-3" /> Instructor
                                    </span>
                                )}
                                {isOwn && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">You</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground text-opacity-60 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {timeAgo(post.created_at)}
                                {post.updated_at && post.updated_at !== post.created_at && ' (edited)'}
                            </div>
                        </div>
                    </div>
                    {isOwn && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => onEdit(post)} className="p-1.5 rounded-lg text-muted-foreground text-opacity-60 hover:text-cyan-400 hover:bg-card border border-border shadow-sm transition-colors" title="Edit">
                                <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => onDelete(post.id)} className="p-1.5 rounded-lg text-muted-foreground text-opacity-60 hover:text-red-400 hover:bg-card border border-border shadow-sm transition-colors" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>

                {/* Actions bar */}
                <div className="mt-3 flex items-center gap-3">
                    <button
                        onClick={() => onVote(post.id)}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${post.user_has_voted
                            ? 'bg-cyan-500/15 text-cyan-400 shadow-sm shadow-cyan-500/10'
                            : 'text-muted-foreground text-opacity-60 hover:text-muted-foreground hover:bg-card border border-border shadow-sm'
                            }`}
                    >
                        <ThumbsUp className={`h-3.5 w-3.5 ${post.user_has_voted ? 'fill-cyan-400' : ''}`} />
                        {post.upvote_count > 0 && <span>{post.upvote_count}</span>}
                    </button>
                    {isAuthenticated && (
                        <button
                            onClick={() => setShowReplyInput(!showReplyInput)}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground text-opacity-60 hover:text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-card border border-border shadow-sm transition-colors"
                        >
                            <Reply className="h-3.5 w-3.5" />
                            Reply
                        </button>
                    )}
                    {post.reply_count > 0 && (
                        <span className="text-[11px] text-muted-foreground text-opacity-40">
                            {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                        </span>
                    )}
                </div>
            </div>

            {/* Reply input */}
            {showReplyInput && (
                <div className="px-4 pb-3">
                    <div className="flex gap-2 items-start">
                        <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            maxLength={5000}
                            rows={2}
                            className="flex-1 px-3 py-2 border border-border bg-card border border-border shadow-sm text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:text-muted-foreground text-opacity-40 resize-none text-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitReply();
                            }}
                        />
                        <Button
                            onClick={handleSubmitReply}
                            disabled={submittingReply || !replyContent.trim()}
                            className="shrink-0 px-3 py-2"
                            size="sm"
                        >
                            {submittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-opacity-40 mt-1">Ctrl+Enter to submit</p>
                </div>
            )}

            {/* Replies section */}
            {((post.latest_replies?.length > 0) || showAllReplies) && (
                <div className="px-4 pb-4 space-y-2">
                    {displayedReplies.map((r) => (
                        editingReply === r.id ? (
                            <div key={r.id} className="pl-4 border-l-2 border-border">
                                <div className="p-3 rounded-lg bg-card border border-border shadow-sm">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        rows={2}
                                        maxLength={5000}
                                        className="w-full px-3 py-2 border border-border bg-card border border-border shadow-sm text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:text-muted-foreground text-opacity-40 resize-none text-sm"
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <Button size="sm" onClick={() => handleSaveEditReply(r.id)} className="text-xs px-3 py-1">Save</Button>
                                        <button onClick={() => { setEditingReply(null); setEditContent(''); }} className="text-xs text-muted-foreground text-opacity-80 hover:text-foreground transition-colors">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <ReplyCard
                                key={r.id}
                                reply={r}
                                userId={userId}
                                onVote={onVote}
                                onEdit={handleEditReply}
                                onDelete={handleDeleteReply}
                            />
                        )
                    ))}

                    {/* Show all replies / load more */}
                    {!showAllReplies && hiddenReplyCount > 0 && (
                        <button
                            onClick={() => loadAllReplies(1)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors ml-6 flex items-center gap-1"
                        >
                            <ChevronDown className="h-3 w-3" />
                            View {hiddenReplyCount} more {hiddenReplyCount === 1 ? 'reply' : 'replies'}
                        </button>
                    )}
                    {showAllReplies && repliesPage < repliesTotalPages && (
                        <button
                            onClick={() => loadAllReplies(repliesPage + 1)}
                            disabled={loadingReplies}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors ml-6 flex items-center gap-1"
                        >
                            {loadingReplies ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                            Load more replies
                        </button>
                    )}
                    {showAllReplies && post.reply_count > 2 && (
                        <button
                            onClick={() => setShowAllReplies(false)}
                            className="text-xs text-muted-foreground text-opacity-60 hover:text-muted-foreground transition-colors ml-6 flex items-center gap-1"
                        >
                            <ChevronUp className="h-3 w-3" />
                            Collapse replies
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main DiscussionSection component ────────────────────────────────────────
const DiscussionSection = ({ courseId, instructorId, lessonId }) => {
    const { user, isAuthenticated } = useAuth();
    const { showToast } = useToast();

    const [posts, setPosts] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalPosts: 0 });
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('recent');

    // Post form
    const [postContent, setPostContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isEnrolled, setIsEnrolled] = useState(false);

    const isInstructor = user?.id === instructorId;

    // ─── Data fetching ───────────────────────────────────────────────
    const fetchPosts = useCallback(async (page = 1, sort = sortBy) => {
        try {
            const params = { page, limit: 10, sort };
            if (lessonId) params.lesson_id = lessonId;
            const res = await api.get(`/discussions/course/${courseId}`, { params });
            if (page === 1) {
                setPosts(res.data.posts);
            } else {
                setPosts(prev => [...prev, ...res.data.posts]);
            }
            setPagination(res.data.pagination);
        } catch (error) {
            console.error('Error fetching discussion posts:', error);
        }
    }, [courseId, sortBy, lessonId]);

    const checkEnrollment = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await api.get(`/enrollments/course/${courseId}`);
            setIsEnrolled(res.data.success);
        } catch {
            setIsEnrolled(false);
        }
    }, [courseId, isAuthenticated]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchPosts(1), checkEnrollment()]);
            setLoading(false);
        };
        init();
    }, [fetchPosts, checkEnrollment]);

    // ─── Create / edit post ──────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!postContent.trim()) {
            showToast('Please enter your question or comment', 'error');
            return;
        }
        try {
            setSubmitting(true);
            if (isEditing && editId) {
                await api.put(`/discussions/${editId}`, { content: postContent.trim() });
                showToast('Post updated!', 'success');
            } else {
                await api.post(`/discussions/course/${courseId}`, { content: postContent.trim(), lesson_id: lessonId || undefined });
                showToast('Question posted!', 'success');
            }
            setPostContent('');
            setIsEditing(false);
            setEditId(null);
            await fetchPosts(1);
        } catch (error) {
            const msg = error.response?.data?.message || 'Error posting';
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReply = async (cId, content, parentId) => {
        try {
            await api.post(`/discussions/course/${cId}`, { content, parent_id: parentId, lesson_id: lessonId || undefined });
            showToast('Reply posted!', 'success');
            await fetchPosts(1);
        } catch (error) {
            const msg = error.response?.data?.message || 'Error posting reply';
            showToast(msg, 'error');
            throw error;
        }
    };

    const handleEdit = (post) => {
        setPostContent(post.content);
        setIsEditing(true);
        setEditId(post.id);
        document.getElementById('discussion-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleDelete = async (postId) => {
        if (!window.confirm('Delete this post? Any replies will also be removed.')) return;
        try {
            await api.delete(`/discussions/${postId}`);
            showToast('Post deleted', 'success');
            await fetchPosts(1);
        } catch (error) {
            const msg = error.response?.data?.message || 'Error deleting post';
            showToast(msg, 'error');
        }
    };

    const handleVote = async (postId) => {
        if (!isAuthenticated) {
            showToast('Login to vote', 'error');
            return;
        }
        try {
            const res = await api.post(`/discussions/${postId}/vote`);
            // Optimistic update
            setPosts(prev => prev.map(p => {
                if (p.id === postId) {
                    return { ...p, user_has_voted: res.data.voted, upvote_count: res.data.upvote_count };
                }
                // Also check nested replies
                if (p.latest_replies) {
                    return {
                        ...p,
                        latest_replies: p.latest_replies.map(r =>
                            r.id === postId ? { ...r, user_has_voted: res.data.voted, upvote_count: res.data.upvote_count } : r
                        )
                    };
                }
                return p;
            }));
        } catch (error) {
            showToast(error.response?.data?.message || 'Error voting', 'error');
        }
    };

    const handleSortChange = (newSort) => {
        setSortBy(newSort);
        fetchPosts(1, newSort);
    };

    const cancelEdit = () => {
        setPostContent('');
        setIsEditing(false);
        setEditId(null);
    };

    const canPost = isAuthenticated && (isEnrolled || isInstructor);

    // ─── Render ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 text-foreground">Discussion</h2>
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8" id="discussion-section">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-cyan-400" />
                    Discussion ({pagination.totalPosts})
                </h2>
                {pagination.totalPosts > 0 && (
                    <div className="flex items-center gap-1 bg-card border border-border shadow-sm rounded-lg p-1 border border-border">
                        <button
                            onClick={() => handleSortChange('recent')}
                            className={`text-xs px-3 py-1.5 rounded-md transition-all ${sortBy === 'recent'
                                ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                                : 'text-muted-foreground text-opacity-80 hover:text-foreground'
                                }`}
                        >
                            Recent
                        </button>
                        <button
                            onClick={() => handleSortChange('popular')}
                            className={`text-xs px-3 py-1.5 rounded-md transition-all ${sortBy === 'popular'
                                ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                                : 'text-muted-foreground text-opacity-80 hover:text-foreground'
                                }`}
                        >
                            Popular
                        </button>
                    </div>
                )}
            </div>

            {/* Post form */}
            {canPost && (
                <div id="discussion-form" className="bg-card border border-border shadow-sm border border-border rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                        {isEditing ? 'Edit Your Post' : 'Ask a Question'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <textarea
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                placeholder="What would you like to ask or discuss?"
                                maxLength={5000}
                                rows={3}
                                className="w-full px-4 py-2.5 border border-border bg-card border border-border shadow-sm text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:text-muted-foreground text-opacity-60 resize-none text-sm"
                            />
                            <p className="text-xs text-muted-foreground text-opacity-40 mt-1 text-right">{postContent.length}/5000</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button type="submit" disabled={submitting || !postContent.trim()} className="text-sm">
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                                {isEditing ? 'Update Post' : 'Post Question'}
                            </Button>
                            {isEditing && (
                                <button type="button" onClick={cancelEdit} className="text-sm text-muted-foreground text-opacity-80 hover:text-foreground transition-colors">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* Not enrolled message */}
            {isAuthenticated && !isEnrolled && !isInstructor && (
                <div className="bg-card border border-border shadow-sm border border-border rounded-xl p-4 mb-6 text-sm text-muted-foreground text-opacity-80 text-center flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Enroll in this course to participate in discussions.
                </div>
            )}

            {!isAuthenticated && (
                <div className="bg-card border border-border shadow-sm border border-border rounded-xl p-4 mb-6 text-sm text-muted-foreground text-opacity-80 text-center">
                    Log in and enroll to ask questions or reply.
                </div>
            )}

            {/* Posts list */}
            <div className="space-y-4">
                {posts.map((post) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        userId={user?.id}
                        isAuthenticated={isAuthenticated}
                        onVote={handleVote}
                        onReply={handleReply}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        showToast={showToast}
                    />
                ))}
            </div>

            {/* Empty state */}
            {pagination.totalPosts === 0 && (
                <div className="text-center py-10">
                    <MessageSquare className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-muted-foreground text-opacity-60 text-sm">No discussions yet. Be the first to ask a question!</p>
                </div>
            )}

            {/* Load more */}
            {pagination.currentPage < pagination.totalPages && (
                <div className="flex justify-center mt-6">
                    <Button
                        variant="outline"
                        onClick={() => fetchPosts(pagination.currentPage + 1)}
                        className="text-sm border-border text-muted-foreground hover:bg-card border border-border shadow-sm"
                    >
                        <ChevronDown className="h-4 w-4 mr-1.5" />
                        Load More Posts
                    </Button>
                </div>
            )}
        </div>
    );
};

export default DiscussionSection;
