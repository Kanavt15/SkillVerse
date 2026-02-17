import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);

    return response.data;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const { token, user } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Refresh points balance from the server
  const refreshPoints = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get('/points');
      const updatedUser = { ...user, points: response.data.points };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return response.data.points;
    } catch (error) {
      console.error('Error refreshing points:', error);
    }
  }, [user]);

  // Update points locally (for instant feedback)
  const updatePoints = useCallback((newPoints) => {
    if (!user) return;
    const updatedUser = { ...user, points: newPoints };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, [user]);

  const value = {
    user,
    login,
    register,
    logout,
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
