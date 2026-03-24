/**
 * Axios instance with JWT token injection and refresh logic
 * NOTE: Store is accessed lazily via getStore() to avoid circular dependency.
 */

import axios from 'axios';

// In dev, use empty baseURL so requests go through Vite proxy (avoids CORS)
// In production, use the configured API URL
const API_BASE_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  : '';

// Lazy store access to break circular dependency
let _store = null;
export const setStore = (store) => { _store = store; };
const getStore = () => _store;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - Add JWT token to headers
 */
apiClient.interceptors.request.use(
  (config) => {
    // Try getting token from Redux store first, then localStorage as fallback
    let token = null;
    const store = getStore();
    if (store) {
      token = store.getState().auth.token;
    }
    if (!token) {
      token = localStorage.getItem('accessToken');
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor - Handle token refresh on 401
 */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  isRefreshing = false;
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const store = getStore();

    if (error.response?.status === 401 && !originalRequest._retry && store) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = store.getState().auth.refreshToken;

      if (!refreshToken) {
        store.dispatch({ type: 'auth/logout' });
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${API_BASE_URL}/api/token/refresh/`,
          { refresh: refreshToken },
          { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
        );

        const { access: newToken } = response.data;

        // Update both Redux store AND localStorage
        store.dispatch({
          type: 'auth/setCredentials',
          payload: { token: newToken, refreshToken },
        });
        localStorage.setItem('accessToken', newToken);

        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Clear localStorage and let auth state handle redirect
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        store.dispatch({ type: 'auth/logout' });
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Get error message from response
 */
export const getErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';

  if (error.response) {
    const { status, data } = error.response;

    if (status === 400 && typeof data === 'object') {
      const firstError = Object.values(data)[0];
      if (Array.isArray(firstError)) return firstError[0];
      if (typeof firstError === 'string') return firstError;
    }

    if (status === 401) return 'Unauthorized. Please login again.';
    if (status === 403) return 'You do not have permission to access this resource.';
    if (status === 404) return 'Resource not found.';
    if (status === 500) return 'Server error. Please try again later.';

    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
  }

  if (error.request && !error.response) {
    return 'Network error. Please check your connection.';
  }

  if (error.message) return error.message;

  return 'An unexpected error occurred.';
};

export default apiClient;
