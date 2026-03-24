/**
 * Authentication state slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient, { getErrorMessage } from '../../utils/api.js';
import { clearPermissionsCache } from '../../hooks/usePermissions.js';
import { clearLookupCache } from '../../hooks/useLookup.js';

// Restore auth state from localStorage on startup
const savedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
const savedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
const savedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;

const initialState = {
  user: savedUser ? JSON.parse(savedUser) : null,
  token: savedToken || null,
  refreshToken: savedRefreshToken || null,
  roles: [],
  permissions: [],
  modules: [],
  warehouseScope: [],
  isLoading: false,
  error: null,
  isAuthenticated: !!savedToken,
};

/**
 * Async thunk for user login
 */
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      // Django SimpleJWT expects username + password
      const response = await apiClient.post('/api/token/', {
        username: credentials.email,
        password: credentials.password,
      });

      const { access, refresh } = response.data;

      // Clear stale caches from previous session
      clearPermissionsCache();
      clearLookupCache();

      // Store tokens and user in localStorage
      const user = { email: credentials.email, name: credentials.email };
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
        localStorage.setItem('user', JSON.stringify(user));
      }

      return {
        token: access,
        refreshToken: refresh,
        user,
        roles: [],
        permissions: [],
        modules: [],
        warehouseScope: [],
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Async thunk to refresh access token
 */
export const refreshAccessToken = createAsyncThunk(
  'auth/refreshAccessToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();

      if (!auth.refreshToken) {
        return rejectWithValue('No refresh token available');
      }

      const response = await apiClient.post('/api/token/refresh/', {
        refresh: auth.refreshToken,
      });

      const { access } = response.data;

      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', access);
      }

      return { token: access };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Async thunk to fetch current user
 */
export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      // Verify token is still valid
      const { auth } = getState();
      await apiClient.post('/api/token/verify/', { token: auth.token });
      return {
        user: auth.user,
        roles: auth.roles || [],
        permissions: auth.permissions || [],
        modules: auth.modules || [],
        warehouseScope: auth.warehouseScope || [],
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Auth slice reducer
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token, refreshToken, user, roles, permissions, modules, warehouse_scope } = action.payload;

      state.token = token || state.token;
      state.refreshToken = refreshToken || state.refreshToken;
      state.user = user || state.user;
      state.roles = roles || state.roles;
      state.permissions = permissions || state.permissions;
      state.modules = modules || state.modules;
      state.warehouseScope = warehouse_scope || state.warehouseScope;
      state.isAuthenticated = !!state.token;
    },

    updateWarehouseScope: (state, action) => {
      state.warehouseScope = action.payload;
    },

    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.roles = [];
      state.permissions = [];
      state.modules = [];
      state.warehouseScope = [];
      state.isAuthenticated = false;
      state.error = null;

      // Clear localStorage and caches
      clearPermissionsCache();
      clearLookupCache();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    },

    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.roles = action.payload.roles;
        state.permissions = action.payload.permissions;
        state.modules = action.payload.modules;
        state.warehouseScope = action.payload.warehouseScope;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      });

    // Refresh token
    builder
      .addCase(refreshAccessToken.pending, (state) => {
        // Don't show loading for refresh
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = action.payload;
      });

    // Fetch current user
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.roles = action.payload.roles;
        state.permissions = action.payload.permissions;
        state.modules = action.payload.modules;
        state.warehouseScope = action.payload.warehouseScope;
        state.isAuthenticated = !!state.token;
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setCredentials,
  updateWarehouseScope,
  logout,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
