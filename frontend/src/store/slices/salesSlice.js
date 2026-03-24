/**
 * Sales module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const salesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Customer PO Upload
    uploadCustomerPO: builder.mutation({
      query: (formData) => ({
        url: '/sales/customer-po/upload/',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['SalesOrders'],
    }),

    getParsedPOs: builder.query({
      query: (params = {}) => ({
        url: '/sales/customer-po/parsed/',
        params,
      }),
      providesTags: ['SalesOrders'],
    }),

    convertPOToSO: builder.mutation({
      query: (body) => ({
        url: '/sales/customer-po/convert-to-so/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SalesOrders'],
    }),

    // Sales Orders
    getSalesOrders: builder.query({
      query: (params = {}) => ({
        url: '/sales/sales-orders/',
        params,
      }),
      providesTags: ['SalesOrders'],
    }),

    getSalesOrder: builder.query({
      query: (id) => `/sales/sales-orders/${id}/`,
      providesTags: (result, error, id) => [{ type: 'SalesOrders', id }],
    }),

    createSalesOrder: builder.mutation({
      query: (body) => ({
        url: '/sales/sales-orders/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SalesOrders'],
    }),

    updateSalesOrder: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/sales/sales-orders/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'SalesOrders', id }],
    }),

    approveSalesOrder: builder.mutation({
      query: (id) => ({
        url: `/sales/sales-orders/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'SalesOrders', id }],
    }),

    rejectSalesOrder: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/sales/sales-orders/${id}/reject/`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'SalesOrders', id }],
    }),

    // Dispatch Challans
    getDispatchChallans: builder.query({
      query: (params = {}) => ({
        url: '/sales/dispatch-challans/',
        params,
      }),
      providesTags: ['DispatchChallans'],
    }),

    getDispatchChallan: builder.query({
      query: (id) => `/sales/dispatch-challans/${id}/`,
      providesTags: (result, error, id) => [{ type: 'DispatchChallans', id }],
    }),

    createDispatchChallan: builder.mutation({
      query: (body) => ({
        url: '/sales/dispatch-challans/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DispatchChallans'],
    }),

    updateDispatchChallan: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/sales/dispatch-challans/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'DispatchChallans', id }],
    }),

    releaseDispatchChallan: builder.mutation({
      query: (id) => ({
        url: `/sales/dispatch-challans/${id}/release/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'DispatchChallans', id }],
    }),

    // Invoices
    getInvoices: builder.query({
      query: (params = {}) => ({
        url: '/sales/invoices/',
        params,
      }),
      providesTags: ['Invoices'],
    }),

    getInvoice: builder.query({
      query: (id) => `/sales/invoices/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Invoices', id }],
    }),

    createInvoice: builder.mutation({
      query: (body) => ({
        url: '/sales/invoices/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Invoices'],
    }),

    updateInvoice: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/sales/invoices/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Invoices', id }],
    }),

    finalizeInvoice: builder.mutation({
      query: (id) => ({
        url: `/sales/invoices/${id}/finalize/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Invoices', id }],
    }),

    getInvoiceChecks: builder.query({
      query: (invoiceId) => `/sales/invoices/${invoiceId}/checks/`,
      providesTags: (result, error, invoiceId) => [{ type: 'Invoices', invoiceId }],
    }),

    processInvoice: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/sales/invoices/${id}/process/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Invoices', id }],
    }),

    acceptInvoice: builder.mutation({
      query: (id) => ({
        url: `/sales/invoices/${id}/accept/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Invoices', id }],
    }),

    // Receivables
    getReceivables: builder.query({
      query: (params = {}) => ({
        url: '/sales/receivables/',
        params,
      }),
      providesTags: ['Receivables'],
    }),

    recordPayment: builder.mutation({
      query: (body) => ({
        url: '/sales/receivables/record-payment/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Receivables', 'Payments'],
    }),

    // Credit Debit Notes
    getCreditDebitNotes: builder.query({
      query: (params = {}) => ({
        url: '/sales/credit-debit-notes/',
        params,
      }),
      providesTags: ['CreditDebitNotes'],
    }),

    createCreditDebitNote: builder.mutation({
      query: (body) => ({
        url: '/sales/credit-debit-notes/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CreditDebitNotes', 'Receivables'],
    }),
  }),
});

export const {
  useUploadCustomerPOMutation,
  useGetParsedPOsQuery,
  useConvertPOToSOMutation,
  useGetSalesOrdersQuery,
  useGetSalesOrderQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useApproveSalesOrderMutation,
  useRejectSalesOrderMutation,
  useGetDispatchChallansQuery,
  useGetDispatchChallanQuery,
  useCreateDispatchChallanMutation,
  useUpdateDispatchChallanMutation,
  useReleaseDispatchChallanMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useFinalizeInvoiceMutation,
  useGetInvoiceChecksQuery,
  useProcessInvoiceMutation,
  useAcceptInvoiceMutation,
  useGetReceivablesQuery,
  useRecordPaymentMutation,
  useGetCreditDebitNotesQuery,
  useCreateCreditDebitNoteMutation,
} = salesApi;
