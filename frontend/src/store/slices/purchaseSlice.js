/**
 * Purchase module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const purchaseApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Purchase Requests
    getPurchaseRequests: builder.query({
      query: (params = {}) => ({
        url: '/purchase/purchase-requests/',
        params,
      }),
      providesTags: ['PurchaseRequests'],
    }),

    getPurchaseRequest: builder.query({
      query: (id) => `/purchase/purchase-requests/${id}/`,
      providesTags: (result, error, id) => [{ type: 'PurchaseRequests', id }],
    }),

    createPurchaseRequest: builder.mutation({
      query: (body) => ({
        url: '/purchase/purchase-requests/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PurchaseRequests'],
    }),

    updatePurchaseRequest: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/purchase/purchase-requests/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'PurchaseRequests', id }],
    }),

    approvePurchaseRequest: builder.mutation({
      query: (id) => ({
        url: `/purchase/purchase-requests/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'PurchaseRequests', id }],
    }),

    rejectPurchaseRequest: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/purchase/purchase-requests/${id}/reject/`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'PurchaseRequests', id }],
    }),

    // RFQs
    getRFQs: builder.query({
      query: (params = {}) => ({
        url: '/purchase/rfqs/',
        params,
      }),
      providesTags: ['RFQs'],
    }),

    getRFQ: builder.query({
      query: (id) => `/purchase/rfqs/${id}/`,
      providesTags: (result, error, id) => [{ type: 'RFQs', id }],
    }),

    createRFQ: builder.mutation({
      query: (body) => ({
        url: '/purchase/rfqs/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RFQs'],
    }),

    updateRFQ: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/purchase/rfqs/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'RFQs', id }],
    }),

    sendRFQ: builder.mutation({
      query: (id) => ({
        url: `/purchase/rfqs/${id}/send/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'RFQs', id }],
    }),

    // Quotes
    getQuotes: builder.query({
      query: (params = {}) => ({
        url: '/purchase/quotes/',
        params,
      }),
      providesTags: ['Quotes'],
    }),

    getQuote: builder.query({
      query: (id) => `/purchase/quotes/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Quotes', id }],
    }),

    submitQuote: builder.mutation({
      query: (body) => ({
        url: '/purchase/quotes/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Quotes'],
    }),

    updateQuote: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/purchase/quotes/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Quotes', id }],
    }),

    // Evaluations
    getEvaluations: builder.query({
      query: (params = {}) => ({
        url: '/purchase/evaluations/',
        params,
      }),
      providesTags: ['Evaluations'],
    }),

    getEvaluation: builder.query({
      query: (id) => `/purchase/evaluations/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Evaluations', id }],
    }),

    createEvaluation: builder.mutation({
      query: (body) => ({
        url: '/purchase/evaluations/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Evaluations'],
    }),

    approveEvaluation: builder.mutation({
      query: (id) => ({
        url: `/purchase/evaluations/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Evaluations', id }],
    }),

    // Purchase Orders
    getPurchaseOrders: builder.query({
      query: (params = {}) => ({
        url: '/purchase/purchase-orders/',
        params,
      }),
      providesTags: ['PurchaseOrders'],
    }),

    getPurchaseOrder: builder.query({
      query: (id) => `/purchase/purchase-orders/${id}/`,
      providesTags: (result, error, id) => [{ type: 'PurchaseOrders', id }],
    }),

    createPurchaseOrder: builder.mutation({
      query: (body) => ({
        url: '/purchase/purchase-orders/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PurchaseOrders'],
    }),

    updatePurchaseOrder: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/purchase/purchase-orders/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'PurchaseOrders', id }],
    }),

    approvePurchaseOrder: builder.mutation({
      query: (id) => ({
        url: `/purchase/purchase-orders/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'PurchaseOrders', id }],
    }),

    // Receipts
    getReceipts: builder.query({
      query: (params = {}) => ({
        url: '/purchase/receipts/',
        params,
      }),
      providesTags: ['Receipts'],
    }),

    getReceipt: builder.query({
      query: (id) => `/purchase/receipts/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Receipts', id }],
    }),

    createReceipt: builder.mutation({
      query: (body) => ({
        url: '/purchase/receipts/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Receipts'],
    }),

    updateReceipt: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/purchase/receipts/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Receipts', id }],
    }),

    // Freight Advices
    getFreightAdvices: builder.query({
      query: (params = {}) => ({
        url: '/purchase/freight-advices/',
        params,
      }),
      providesTags: ['FreightAdvices'],
    }),

    getFreightAdvice: builder.query({
      query: (id) => `/purchase/freight-advices/${id}/`,
      providesTags: (result, error, id) => [{ type: 'FreightAdvices', id }],
    }),

    // Payment Advices
    getPaymentAdvices: builder.query({
      query: (params = {}) => ({
        url: '/purchase/payment-advices/',
        params,
      }),
      providesTags: ['PaymentAdvices'],
    }),

    getPaymentAdvice: builder.query({
      query: (id) => `/purchase/payment-advices/${id}/`,
      providesTags: (result, error, id) => [{ type: 'PaymentAdvices', id }],
    }),

    createPaymentAdvice: builder.mutation({
      query: (body) => ({
        url: '/purchase/payment-advices/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PaymentAdvices'],
    }),

    approvePaymentAdvice: builder.mutation({
      query: (id) => ({
        url: `/purchase/payment-advices/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'PaymentAdvices', id }],
    }),
  }),
});

export const {
  useGetPurchaseRequestsQuery,
  useGetPurchaseRequestQuery,
  useCreatePurchaseRequestMutation,
  useUpdatePurchaseRequestMutation,
  useApprovePurchaseRequestMutation,
  useRejectPurchaseRequestMutation,
  useGetRFQsQuery,
  useGetRFQQuery,
  useCreateRFQMutation,
  useUpdateRFQMutation,
  useSendRFQMutation,
  useGetQuotesQuery,
  useGetQuoteQuery,
  useSubmitQuoteMutation,
  useUpdateQuoteMutation,
  useGetEvaluationsQuery,
  useGetEvaluationQuery,
  useCreateEvaluationMutation,
  useApproveEvaluationMutation,
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useGetReceiptsQuery,
  useGetReceiptQuery,
  useCreateReceiptMutation,
  useUpdateReceiptMutation,
  useGetFreightAdvicesQuery,
  useGetFreightAdviceQuery,
  useGetPaymentAdvicesQuery,
  useGetPaymentAdviceQuery,
  useCreatePaymentAdviceMutation,
  useApprovePaymentAdviceMutation,
} = purchaseApi;
