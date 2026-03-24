/**
 * RTK Query base API slice
 * Configured with JWT token injection, auto-refresh, and all module tag types
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    headers.set('Content-Type', 'application/json');

    return headers;
  },
  credentials: 'include',
});

/**
 * Custom baseQuery with auto-refresh logic
 */
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const refreshToken = api.getState().auth.refreshToken;

    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh/',
          method: 'POST',
          body: { refresh: refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        const { access: newToken } = refreshResult.data;

        api.dispatch({
          type: 'auth/setCredentials',
          payload: {
            token: newToken,
            refreshToken,
          },
        });

        // Retry original request with new token
        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch({ type: 'auth/logout' });
      }
    } else {
      api.dispatch({ type: 'auth/logout' });
    }
  }

  return result;
};

/**
 * Create API slice with all tag types
 */
export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Companies',
    'Warehouses',
    'Products',
    'Vendors',
    'Customers',
    'PurchaseRequests',
    'RFQs',
    'Quotes',
    'Evaluations',
    'PurchaseOrders',
    'Receipts',
    'FreightAdvices',
    'PaymentAdvices',
    'SalesOrders',
    'DispatchChallans',
    'Invoices',
    'Receivables',
    'Payments',
    'BOM',
    'WorkOrders',
    'WageVouchers',
    'YieldLogs',
    'QCRequests',
    'LabJobs',
    'QCReports',
    'CounterSamples',
    'StockLedger',
    'StockTransfers',
    'Shifting',
    'JobWork',
    'Returns',
    'Adjustments',
    'Ledgers',
    'BankStatements',
    'CreditDebitNotes',
    'PettyCash',
    'GST',
    'Staff',
    'Attendance',
    'Leave',
    'Overtime',
    'Payroll',
    'Auth',
    'Master',
    'Dashboard',
  ],
  endpoints: builder => ({
    // Health check
    healthCheck: builder.query({
      query: () => '/health/',
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useHealthCheckQuery } = apiSlice;
