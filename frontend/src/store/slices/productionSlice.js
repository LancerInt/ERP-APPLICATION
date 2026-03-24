/**
 * Production module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const productionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // BOM
    getBOMs: builder.query({
      query: (params = {}) => ({
        url: '/production/boms/',
        params,
      }),
      providesTags: ['BOM'],
    }),

    getBOM: builder.query({
      query: (id) => `/production/boms/${id}/`,
      providesTags: (result, error, id) => [{ type: 'BOM', id }],
    }),

    createBOM: builder.mutation({
      query: (body) => ({
        url: '/production/boms/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BOM'],
    }),

    updateBOM: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/production/boms/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'BOM', id }],
    }),

    // Work Orders
    getWorkOrders: builder.query({
      query: (params = {}) => ({
        url: '/production/work-orders/',
        params,
      }),
      providesTags: ['WorkOrders'],
    }),

    getWorkOrder: builder.query({
      query: (id) => `/production/work-orders/${id}/`,
      providesTags: (result, error, id) => [{ type: 'WorkOrders', id }],
    }),

    createWorkOrder: builder.mutation({
      query: (body) => ({
        url: '/production/work-orders/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkOrders'],
    }),

    updateWorkOrder: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/production/work-orders/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'WorkOrders', id }],
    }),

    releaseWorkOrder: builder.mutation({
      query: (id) => ({
        url: `/production/work-orders/${id}/release/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'WorkOrders', id }],
    }),

    completeWorkOrder: builder.mutation({
      query: (id) => ({
        url: `/production/work-orders/${id}/complete/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'WorkOrders', id }],
    }),

    // Work Order Items
    getWorkOrderItems: builder.query({
      query: (workOrderId) => `/production/work-orders/${workOrderId}/items/`,
      providesTags: (result, error, workOrderId) => [{ type: 'WorkOrders', workOrderId }],
    }),

    updateWorkOrderItem: builder.mutation({
      query: ({ workOrderId, itemId, ...body }) => ({
        url: `/production/work-orders/${workOrderId}/items/${itemId}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { workOrderId }) => [{ type: 'WorkOrders', workOrderId }],
    }),

    // Wage Vouchers
    getWageVouchers: builder.query({
      query: (params = {}) => ({
        url: '/production/wage-vouchers/',
        params,
      }),
      providesTags: ['WageVouchers'],
    }),

    getWageVoucher: builder.query({
      query: (id) => `/production/wage-vouchers/${id}/`,
      providesTags: (result, error, id) => [{ type: 'WageVouchers', id }],
    }),

    createWageVoucher: builder.mutation({
      query: (body) => ({
        url: '/production/wage-vouchers/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WageVouchers'],
    }),

    updateWageVoucher: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/production/wage-vouchers/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'WageVouchers', id }],
    }),

    approveWageVoucher: builder.mutation({
      query: (id) => ({
        url: `/production/wage-vouchers/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'WageVouchers', id }],
    }),

    // Yield Logs
    getYieldLogs: builder.query({
      query: (params = {}) => ({
        url: '/production/yield-logs/',
        params,
      }),
      providesTags: ['YieldLogs'],
    }),

    createYieldLog: builder.mutation({
      query: (body) => ({
        url: '/production/yield-logs/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['YieldLogs'],
    }),

    updateYieldLog: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/production/yield-logs/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'YieldLogs', id }],
    }),
  }),
});

export const {
  useGetBOMsQuery,
  useGetBOMQuery,
  useCreateBOMMutation,
  useUpdateBOMMutation,
  useGetWorkOrdersQuery,
  useGetWorkOrderQuery,
  useCreateWorkOrderMutation,
  useUpdateWorkOrderMutation,
  useReleaseWorkOrderMutation,
  useCompleteWorkOrderMutation,
  useGetWorkOrderItemsQuery,
  useUpdateWorkOrderItemMutation,
  useGetWageVouchersQuery,
  useGetWageVoucherQuery,
  useCreateWageVoucherMutation,
  useUpdateWageVoucherMutation,
  useApproveWageVoucherMutation,
  useGetYieldLogsQuery,
  useCreateYieldLogMutation,
  useUpdateYieldLogMutation,
} = productionApi;
