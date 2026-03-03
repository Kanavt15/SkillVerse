import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Star, Edit2, Trash2, Loader2, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';

// Star rating input component
const StarRating = ({ value, onChange, size = 'md', readonly = false }) => {
    const [hover, setHover] = useState(0);
    const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
    const sizeClass = sizes[size] || sizes.md;

    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    onClick={() => !readonly && onChange?.(star)}
                    onMouseEnter={() => !readonly && setHover(star)}
                    onMouseLeave={() => !readonly && setHover(0)}
                    className={`transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                >
                    <Star
                        className={`${sizeClass} transition-colors ${star <= (hover || value)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-600'
                            }`}
                    />
                </button>
            ))}
        </div>
    );
};

// Single review card
const ReviewCard = ({ review, isOwn, onEdit, onDelete }) => {
    const initial = review.full_name?.charAt(0)?.toUpperCase() || '?';
    const date = new Date(review.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
    const wasEdited = review.updated_at && review.updated_at !== review.created_at;

    return (
        <div className={`p-4 rounded-xl border transition-colors ${isOwn
                ? 'bg-cyan-500/5 border-cyan-500/20'
                : 'bg-white/[0.03] border-white/[0.06]'
            }`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <span className="text-cyan-400 font-bold text-sm">{initial}</span>
                    </div>
                    <div>
                        <p className="font-medium text-white text-sm">
                            {review.full_name}
                            {isOwn && (
                                <span className="ml-2 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">You</span>
                            )}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <StarRating value={review.rating} readonly size="sm" />
                            <span className="text-xs text-slate-500">
                                {date}{wasEdited ? ' (edited)' : ''}
                            </span>
                        </div>
                    </div>
                </div>
                {isOwn && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => onEdit(review)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] transition-colors"
                            title="Edit review"
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => onDelete(review.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                            title="Delete review"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>
            {review.comment && (
                <p className="mt-3 text-sm text-slate-300 leading-relaxed pl-12">{review.comment}</p>
            )}
        </div>
    );
};

// Rating distribution bar
const RatingBar = ({ star, count, total }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-4 text-right">{star}</span>
            <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-slate-500 w-8 text-right">{count}</span>
        </div>
    );
};

// Main ReviewSection component
const ReviewSection = ({ courseId, instructorId }) => {
    const { user, isAuthenticated } = useAuth();
    const { showToast } = useToast();

    const [reviews, setReviews] = useState([]);
    const [myReview, setMyReview] = useState(null);
    const [distribution, setDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalReviews: 0 });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false);

    // Form state
    const [formRating, setFormRating] = useState(0);
    const [formComment, setFormComment] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const isInstructor = user?.id === instructorId;

    const fetchReviews = useCallback(async (page = 1) => {
        try {
            const res = await api.get(`/reviews/course/${courseId}`, {
                params: { page, limit: 5 }
            });
            if (page === 1) {
                setReviews(res.data.reviews);
            } else {
                setReviews(prev => [...prev, ...res.data.reviews]);
            }
            setDistribution(res.data.ratingDistribution);
            setPagination(res.data.pagination);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        }
    }, [courseId]);

    const fetchMyReview = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await api.get(`/reviews/course/${courseId}/mine`);
            setMyReview(res.data.review);
        } catch {
            setMyReview(null);
        }
    }, [courseId, isAuthenticated]);

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
            await Promise.all([fetchReviews(1), fetchMyReview(), checkEnrollment()]);
            setLoading(false);
        };
        init();
    }, [fetchReviews, fetchMyReview, checkEnrollment]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formRating === 0) {
            showToast('Please select a rating', 'error');
            return;
        }

        try {
            setSubmitting(true);
            if (isEditing && editId) {
                await api.put(`/reviews/${editId}`, { rating: formRating, comment: formComment });
                showToast('Review updated!', 'success');
            } else {
                await api.post(`/reviews/course/${courseId}`, { rating: formRating, comment: formComment });
                showToast('Review submitted!', 'success');
            }

            // Reset form
            setFormRating(0);
            setFormComment('');
            setIsEditing(false);
            setEditId(null);

            // Refresh data
            await Promise.all([fetchReviews(1), fetchMyReview()]);
        } catch (error) {
            const msg = error.response?.data?.message || 'Error submitting review';
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (review) => {
        setFormRating(review.rating);
        setFormComment(review.comment || '');
        setIsEditing(true);
        setEditId(review.id);
        // Scroll to form
        document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm('Are you sure you want to delete your review?')) return;
        try {
            await api.delete(`/reviews/${reviewId}`);
            showToast('Review deleted', 'success');
            setMyReview(null);
            await fetchReviews(1);
        } catch (error) {
            const msg = error.response?.data?.message || 'Error deleting review';
            showToast(msg, 'error');
        }
    };

    const handleLoadMore = () => {
        fetchReviews(pagination.currentPage + 1);
    };

    const cancelEdit = () => {
        setFormRating(0);
        setFormComment('');
        setIsEditing(false);
        setEditId(null);
    };

    // Compute average from distribution
    const totalReviews = pagination.totalReviews;
    const avgRating = totalReviews > 0
        ? Object.entries(distribution).reduce((sum, [star, count]) => sum + star * count, 0) / totalReviews
        : 0;

    const canReview = isAuthenticated && isEnrolled && !isInstructor && !myReview;
    const showForm = canReview || isEditing;

    if (loading) {
        return (
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 text-white">Reviews</h2>
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8" id="reviews-section">
            <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-cyan-400" />
                Reviews ({totalReviews})
            </h2>

            {/* Rating Summary */}
            {totalReviews > 0 && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 mb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        {/* Average */}
                        <div className="text-center sm:pr-6 sm:border-r border-white/[0.08]">
                            <p className="text-4xl font-bold text-white">{avgRating.toFixed(1)}</p>
                            <StarRating value={Math.round(avgRating)} readonly size="sm" />
                            <p className="text-xs text-slate-500 mt-1">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>
                        </div>
                        {/* Distribution */}
                        <div className="flex-1 w-full space-y-1.5">
                            {[5, 4, 3, 2, 1].map((star) => (
                                <RatingBar key={star} star={star} count={distribution[star] || 0} total={totalReviews} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Review Form */}
            {showForm && (
                <div id="review-form" className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-white mb-3">
                        {isEditing ? 'Edit Your Review' : 'Write a Review'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Rating</label>
                            <StarRating value={formRating} onChange={setFormRating} size="lg" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Comment (optional)</label>
                            <textarea
                                value={formComment}
                                onChange={(e) => setFormComment(e.target.value)}
                                placeholder="Share your experience with this course..."
                                maxLength={2000}
                                rows={3}
                                className="w-full px-4 py-2.5 border border-white/[0.1] bg-white/[0.05] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:text-slate-500 resize-none text-sm"
                            />
                            <p className="text-xs text-slate-600 mt-1 text-right">{formComment.length}/2000</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button type="submit" disabled={submitting || formRating === 0} className="text-sm">
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                ) : null}
                                {isEditing ? 'Update Review' : 'Submit Review'}
                            </Button>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* Info messages */}
            {isAuthenticated && !isEnrolled && !isInstructor && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-6 text-sm text-slate-400 text-center">
                    Enroll in this course to leave a review.
                </div>
            )}
            {isInstructor && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-6 text-sm text-slate-400 text-center">
                    You cannot review your own course.
                </div>
            )}

            {/* Your existing review (shown only if not editing) */}
            {myReview && !isEditing && (
                <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Your Review</p>
                    <ReviewCard
                        review={myReview}
                        isOwn={true}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </div>
            )}

            {/* Reviews List */}
            <div className="space-y-3">
                {reviews
                    .filter(r => r.user_id !== user?.id) // Don't duplicate own review
                    .map((review) => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            isOwn={false}
                        />
                    ))}
            </div>

            {totalReviews === 0 && (
                <div className="text-center py-8">
                    <Star className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No reviews yet. Be the first to review this course!</p>
                </div>
            )}

            {/* Load More */}
            {pagination.currentPage < pagination.totalPages && (
                <div className="flex justify-center mt-6">
                    <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        className="text-sm border-white/[0.1] text-slate-300 hover:bg-white/[0.06]"
                    >
                        <ChevronDown className="h-4 w-4 mr-1.5" />
                        Load More Reviews
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ReviewSection;
