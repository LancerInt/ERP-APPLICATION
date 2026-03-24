/**
 * Inventory module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const inventoryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Stock Ledger
    getStockLedger: builder.query({
      query: (params = {}) => ({
        url: '/inventory/stock-ledger/',
        params,
      }),
      providesTags: ['StockLedger'],
    }),

    getStockByProduct: builder.query({
      query: (productId) => `/inventory/stock-ledger/?product_id=${productId}`,
      providesTags: (result, error, productId) => [{ type: 'StockLedger', productId }],
    }),

    // Stock Transfers
    getStockTransfers: builder.query({
      query: (params = {}) => ({
        url: '/inventory/stock-transfers/',
        params,
      }),
      providesTags: ['StockTransfers'],
    }),

    getStockTransfer: builder.query({
      query: (id) => `/inventory/stock-transfers/${id}/`,
      providesTags: (result, error, id) => [{ type: 'StockTransfers', id }],
    }),

    createStockTransfer: builder.mutation({
      query: (body) => ({
        url: '/inventory/stock-transfers/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StockTransfers', 'StockLedger'],
    }),

    updateStockTransfer: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/inventory/stock-transfers/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'StockTransfers', id }],
    }),

    approveStockTransfer: builder.mutation({
      query: (id) => ({
        url: `/inventory/stock-transfers/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'StockTransfers', id }, 'StockLedger'],
    }),

    // Shifting
    getShifting: builder.query({
      query: (params = {}) => ({
        url: '/inventory/shifting/',
        params,
      }),
      providesTags: ['Shifting'],
    }),

    getShiftingRecord: builder.query({
      query: (id) => `/inventory/shifting/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Shifting', id }],
    }),

    createShifting: builder.mutation({
      query: (body) => ({
        url: '/inventory/shifting/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Shifting', 'StockLedger'],
    }),

    updateShifting: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/inventory/shifting/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Shifting', id }],
    }),

    // Job Work
    getJobWork: builder.query({
      query: (params = {}) => ({
        url: '/inventory/job-work/',
        params,
      }),
      providesTags: ['JobWork'],
    }),

    getJobWorkRecord: builder.query({
      query: (id) => `/inventory/job-work/${id}/`,
      providesTags: (result, error, id) => [{ type: 'JobWork', id }],
    }),

    createJobWork: builder.mutation({
      query: (body) => ({
        url: '/inventory/job-work/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['JobWork', 'StockLedger'],
    }),

    updateJobWork: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/inventory/job-work/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'JobWork', id }],
    }),

    completeJobWork: builder.mutation({
      query: (id) => ({
        url: `/inventory/job-work/${id}/complete/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'JobWork', id }, 'StockLedger'],
    }),

    // Returns
    getReturns: builder.query({
      query: (params = {}) => ({
        url: '/inventory/returns/',
        params,
      }),
      providesTags: ['Returns'],
    }),

    getReturn: builder.query({
      query: (id) => `/inventory/returns/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Returns', id }],
    }),

    createReturn: builder.mutation({
      query: (body) => ({
        url: '/inventory/returns/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Returns', 'StockLedger'],
    }),

    updateReturn: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/inventory/returns/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Returns', id }],
    }),

    receiveReturn: builder.mutation({
      query: (id) => ({
        url: `/inventory/returns/${id}/receive/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Returns', id }, 'StockLedger'],
    }),

    // Adjustments
    getAdjustments: builder.query({
      query: (params = {}) => ({
        url: '/inventory/adjustments/',
        params,
      }),
      providesTags: ['Adjustments'],
    }),

    getAdjustment: builder.query({
      query: (id) => `/inventory/adjustments/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Adjustments', id }],
    }),

    createAdjustment: builder.mutation({
      query: (body) => ({
        url: '/inventory/adjustments/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Adjustments', 'StockLedger'],
    }),

    updateAdjustment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/inventory/adjustments/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Adjustments', id }],
    }),

    approveAdjustment: builder.mutation({
      query: (id) => ({
        url: `/inventory/adjustments/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Adjustments', id }, 'StockLedger'],
    }),

    // Inventory Dashboard
    getInventoryDashboard: builder.query({
      query: () => '/inventory/dashboard/',
      providesTags: ['Dashboard'],
    }),

    getStockValuation: builder.query({
      query: (params = {}) => ({
        url: '/inventory/stock-valuation/',
        params,
      }),
      providesTags: ['StockLedger'],
    }),
  }),
});

export const {
  useGetStockLedgerQuery,
  useGetStockByProductQuery,
  useGetStockTransfersQuery,
  useGetStockTransferQuery,
  useCreateStockTransferMutation,
  useUpdateStockTransferMutation,
  useApproveStockTransferMutation,
  useGetShiftingQuery,
  useGetShiftingRecordQuery,
  useCreateShiftingMutation,
  useUpdateShiftingMutation,
  useGetJobWorkQuery,
  useGetJobWorkRecordQuery,
  useCreateJobWorkMutation,
  useUpdateJobWorkMutation,
  useCompleteJobWorkMutation,
  useGetReturnsQuery,
  useGetReturnQuery,
  useCreateReturnMutation,
  useUpdateReturnMutation,
  useReceiveReturnMutation,
  useGetAdjustmentsQuery,
  useGetAdjustmentQuery,
  useCreateAdjustmentMutation,
  useUpdateAdjustmentMutation,
  useApproveAdjustmentMutation,
  useGetInventoryDashboardQuery,
  useGetStockValuationQuery,
} = inventoryApi;
