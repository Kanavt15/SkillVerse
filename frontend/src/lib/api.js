import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// In-memory access token storage (not localStorage for security)
let accessToken = null;
let isRefreshing = false;
let refreshSubscribers = [];

// Utility to get/set access token
export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;
export const clearAccessToken = () => { accessToken = null; };

// Subscribe to token refresh completion
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
};

const onTokenRefreshFailed = () => {
  refreshSubscribers.forEach(callback => callback(null));
  refreshSubscribers = [];
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true // CRITICAL: Enables sending/receiving cookies
});

// Request interceptor - attach access token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Don't set Content-Type for FormData — let the browser set it with boundary
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 with TOKEN_EXPIRED code and we haven't retried yet
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;

      try {
        // Call refresh endpoint (cookie sent automatically with withCredentials)
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken: newAccessToken } = response.data;
        setAccessToken(newAccessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        isRefreshing = false;
        onTokenRefreshed(newAccessToken);

        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onTokenRefreshFailed();

        // Refresh failed - clear token and redirect to login (if not already there)
        clearAccessToken();
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // For other 401 errors (NO_TOKEN, INVALID_TOKEN), redirect to login
    // But only if we're not already on the login or register page
    // AND only if the request is not to the refresh endpoint itself (to avoid redirect loops on initialization)
    if (error.response?.status === 401) {
      clearAccessToken();
      const currentPath = window.location.pathname;
      const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');

      if (!isRefreshEndpoint && currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
