import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Bell, BookOpen, Trophy, Award, UserPlus, Check, CheckCheck, Loader2, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Notification type icons & colors
const typeConfig = {
    enrollment: {
        icon: BookOpen,
        color: 'text-cyan-400',
        bg: 'bg-cyan-400/10',
        border: 'border-cyan-400/20'
    },
    new_lesson: {
        icon: BookOpen,
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/10',
        border: 'border-emerald-400/20'
    },
    certificate: {
        icon: Award,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400/20'
    },
    follower: {
        icon: UserPlus,
        color: 'text-violet-400',
        bg: 'bg-violet-400/10',
        border: 'border-violet-400/20'
    }
};

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}

const NotificationDropdown = () => {
    const { isAuthenticated } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const dropdownRef = useRef(null);
    const socketRef = useRef(null);

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await api.get('/notifications/unread-count');
            setUnreadCount(res.data.count);
        } catch (err) {
            console.error('Error fetching unread count:', err);
        }
    }, []);

    // Fetch notifications (paginated)
    const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
        setLoading(true);
        try {
            const res = await api.get(`/notifications?page=${pageNum}&limit=10`);
            const { notifications: data, pagination } = res.data;

            setNotifications(prev => append ? [...prev, ...data] : data);
            setTotalCount(pagination.total);
            setHasMore(pageNum < pagination.totalPages);
            setPage(pageNum);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Connect to WebSocket
    useEffect(() => {
        if (!isAuthenticated) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        // Extract base URL (remove /api suffix)
        const wsUrl = API_URL.replace(/\/api\/?$/, '');

        const socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        socket.on('connect', () => {
            console.log('🔌 Notification socket connected');
            socket.emit('authenticate', token);
        });

        socket.on('authenticated', () => {
            console.log('🔐 Notification socket authenticated');
        });

        socket.on('new_notification', (notification) => {
            // Prepend to list and bump unread count
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setTotalCount(prev => prev + 1);
        });

        socket.on('auth_error', (err) => {
            console.error('❌ Socket auth error:', err.message);
        });

        socketRef.current = socket;

        // Fetch initial unread count
        fetchUnreadCount();

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isAuthenticated, fetchUnreadCount]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // When dropdown opens, fetch notifications
    const handleToggle = () => {
        const willOpen = !isOpen;
        setIsOpen(willOpen);
        if (willOpen) {
            fetchNotifications(1, false);
        }
    };

    // Mark single notification as read
    const markAsRead = async (notifId) => {
        try {
            await api.put(`/notifications/${notifId}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    // Load more
    const loadMore = () => {
        if (!loading && hasMore) {
            fetchNotifications(page + 1, true);
        }
    };

    if (!isAuthenticated) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                aria-label="Notifications"
                id="notification-bell"
            >
                <Bell className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'scale-110' : ''}`} />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-lg shadow-red-500/30 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-h-[480px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f1629]/95 backdrop-blur-2xl shadow-2xl shadow-black/40 z-50 flex flex-col"
                    id="notification-panel"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                        <h3 className="text-sm font-semibold text-white">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                    title="Mark all as read"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    <span>Mark all read</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors md:hidden"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                        {notifications.length === 0 && !loading ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4">
                                <Bell className="h-10 w-10 text-slate-600 mb-3" />
                                <p className="text-sm text-slate-400 text-center">No notifications yet</p>
                                <p className="text-xs text-slate-500 mt-1 text-center">
                                    You'll see updates here when something happens
                                </p>
                            </div>
                        ) : (
                            <>
                                {notifications.map((notif) => {
                                    const config = typeConfig[notif.type] || typeConfig.enrollment;
                                    const Icon = config.icon;

                                    return (
                                        <button
                                            key={notif.id}
                                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                                            className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-white/[0.04] transition-all duration-200 hover:bg-white/[0.04] ${!notif.is_read ? 'bg-white/[0.02]' : ''
                                                }`}
                                        >
                                            {/* Type Icon */}
                                            <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center mt-0.5`}>
                                                <Icon className={`h-4 w-4 ${config.color}`} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${!notif.is_read ? 'text-white' : 'text-slate-300'}`}>
                                                        {notif.title}
                                                    </p>
                                                    {!notif.is_read && (
                                                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shadow-sm shadow-cyan-400/50" />
                                                    )}
                                                </div>
                                                <p className={`text-xs mt-0.5 line-clamp-2 ${!notif.is_read ? 'text-slate-300' : 'text-slate-400'}`}>
                                                    {notif.message}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {timeAgo(notif.created_at)}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Load More */}
                                {hasMore && (
                                    <div className="px-4 py-3 border-t border-white/[0.06]">
                                        <button
                                            onClick={loadMore}
                                            disabled={loading}
                                            className="w-full text-center text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:text-slate-500 transition-colors py-1"
                                        >
                                            {loading ? (
                                                <span className="flex items-center justify-center gap-1.5">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Loading...
                                                </span>
                                            ) : (
                                                `Load more (${totalCount - notifications.length} remaining)`
                                            )}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Loading State (initial load) */}
                        {loading && notifications.length === 0 && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
