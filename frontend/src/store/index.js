/**
 * Redux store configuration with all slices and middleware
 */

import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from './api/apiSlice.js';
import authReducer from './slices/authSlice.js';
import masterReducer from './slices/masterSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    master: masterReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/loginUser/fulfilled'],
        ignoredPaths: ['auth.user'],
      },
    }).concat(apiSlice.middleware),

  devTools: import.meta.env.MODE !== 'production',
});

export default store;
