import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import api, { setAccessToken, clearAccessToken, getAccessToken } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Decode a JWT token payload without verification (for client-side expiry checks).
 * Returns null if the token is malformed.
 */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  /**
   * Schedule proactive token refresh before expiry
   */
  const scheduleTokenRefresh = useCallback((token) => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return;

    // Refresh 1 minute before expiry
    const expiresAt = decoded.exp * 1000;
    const refreshAt = expiresAt - 60000; // 1 minute before
    const delay = refreshAt - Date.now();

    if (delay > 0) {
      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await api.post('/auth/refresh');
          const { accessToken } = response.data;
          setAccessToken(accessToken);
          scheduleTokenRefresh(accessToken); // Schedule next refresh
        } catch (error) {
          console.error('Proactive refresh failed:', error);
          // Let interceptor handle the retry on next request
        }
      }, delay);
    }
  }, []);

  /**
   * Initialize auth state on mount - try to restore session via refresh token
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to refresh token on app load (cookie will be sent automatically)
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;
        setAccessToken(accessToken);

        // Fetch user profile
        const profileResponse = await api.get('/auth/profile');
        setUser(profileResponse.data.user);

        // Schedule proactive refresh
        scheduleTokenRefresh(accessToken);
      } catch (error) {
        // No valid refresh token - user needs to log in
        clearAccessToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Cleanup on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [scheduleTokenRefresh]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, user } = response.data;

    setAccessToken(accessToken);
    setUser(user);
    scheduleTokenRefresh(accessToken);

    return response.data;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const { accessToken, user } = response.data;

    setAccessToken(accessToken);
    setUser(user);
    scheduleTokenRefresh(accessToken);

    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      clearAccessToken();
      setUser(null);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    }
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      clearAccessToken();
      setUser(null);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  // Refresh points balance from the server
  const refreshPoints = useCallback(async () => {
    if (!user) return;

    try {
      const response = await api.get('/points');
      const updatedUser = { ...user, points: response.data.points };
      setUser(updatedUser);
      return response.data.points;
    } catch (error) {
      console.error('Error refreshing points:', error);
    }
  }, [user]);

  // Update points locally (for instant feedback)
  const updatePoints = useCallback((newPoints) => {
    if (!user) return;
    setUser(prev => ({ ...prev, points: newPoints }));
  }, [user]);

  const value = {
    user,
    login,
    register,
    logout,
    logoutAll,
    updateUser,
    refreshPoints,
    updatePoints,
    loading,
    isAuthenticated: !!user,
    isInstructor: user?.role === 'instructor' || user?.role === 'both',
    isLearner: user?.role === 'learner' || user?.role === 'both',
    points: user?.points || 0
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
