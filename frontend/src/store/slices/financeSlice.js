/**
 * Finance module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const financeApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Ledgers
    getLedgers: builder.query({
      query: (params = {}) => ({
        url: '/finance/ledgers/',
        params,
      }),
      providesTags: ['Ledgers'],
    }),

    getLedger: builder.query({
      query: (id) => `/finance/ledgers/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Ledgers', id }],
    }),

    getLedgerEntries: builder.query({
      query: ({ ledgerId, ...params }) => ({
        url: `/finance/ledgers/${ledgerId}/entries/`,
        params,
      }),
      providesTags: (result, error, { ledgerId }) => [{ type: 'Ledgers', ledgerId }],
    }),

    createLedgerEntry: builder.mutation({
      query: ({ ledgerId, ...body }) => ({
        url: `/finance/ledgers/${ledgerId}/entries/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { ledgerId }) => [{ type: 'Ledgers', ledgerId }],
    }),

    // Payments
    getPayments: builder.query({
      query: (params = {}) => ({
        url: '/finance/payments/',
        params,
      }),
      providesTags: ['Payments'],
    }),

    getPayment: builder.query({
      query: (id) => `/finance/payments/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Payments', id }],
    }),

    createPayment: builder.mutation({
      query: (body) => ({
        url: '/finance/payments/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Payments', 'Ledgers'],
    }),

    updatePayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/finance/payments/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Payments', id }],
    }),

    approvePayment: builder.mutation({
      query: (id) => ({
        url: `/finance/payments/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Payments', id }],
    }),

    processPayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/finance/payments/${id}/process/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Payments', id }, 'Ledgers'],
    }),

    // Bank Statements
    getBankStatements: builder.query({
      query: (params = {}) => ({
        url: '/finance/bank-statements/',
        params,
      }),
      providesTags: ['BankStatements'],
    }),

    getBankStatement: builder.query({
      query: (id) => `/finance/bank-statements/${id}/`,
      providesTags: (result, error, id) => [{ type: 'BankStatements', id }],
    }),

    importBankStatement: builder.mutation({
      query: (formData) => ({
        url: '/finance/bank-statements/import/',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['BankStatements'],
    }),

    reconcileBankStatement: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/finance/bank-statements/${id}/reconcile/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'BankStatements', id }],
    }),

    // Credit Debit Notes
    getCreditDebitNotes: builder.query({
      query: (params = {}) => ({
        url: '/finance/credit-debit-notes/',
        params,
      }),
      providesTags: ['CreditDebitNotes'],
    }),

    getCreditDebitNote: builder.query({
      query: (id) => `/finance/credit-debit-notes/${id}/`,
      providesTags: (result, error, id) => [{ type: 'CreditDebitNotes', id }],
    }),

    createCreditDebitNote: builder.mutation({
      query: (body) => ({
        url: '/finance/credit-debit-notes/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CreditDebitNotes', 'Ledgers'],
    }),

    approveCreditDebitNote: builder.mutation({
      query: (id) => ({
        url: `/finance/credit-debit-notes/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'CreditDebitNotes', id }],
    }),

    // Petty Cash
    getPettyCash: builder.query({
      query: (params = {}) => ({
        url: '/finance/petty-cash/',
        params,
      }),
      providesTags: ['PettyCash'],
    }),

    getPettyCashRecord: builder.query({
      query: (id) => `/finance/petty-cash/${id}/`,
      providesTags: (result, error, id) => [{ type: 'PettyCash', id }],
    }),

    createPettyCashVoucher: builder.mutation({
      query: (body) => ({
        url: '/finance/petty-cash/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PettyCash', 'Ledgers'],
    }),

    approvePettyCashVoucher: builder.mutation({
      query: (id) => ({
        url: `/finance/petty-cash/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'PettyCash', id }],
    }),

    // GST
    getGSTReturns: builder.query({
      query: (params = {}) => ({
        url: '/finance/gst-returns/',
        params,
      }),
      providesTags: ['GST'],
    }),

    getGSTReturn: builder.query({
      query: (id) => `/finance/gst-returns/${id}/`,
      providesTags: (result, error, id) => [{ type: 'GST', id }],
    }),

    generateGSTReturn: builder.mutation({
      query: (body) => ({
        url: '/finance/gst-returns/generate/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['GST'],
    }),

    getGSTLiability: builder.query({
      query: (params = {}) => ({
        url: '/finance/gst-liability/',
        params,
      }),
      providesTags: ['GST'],
    }),

    // Finance Dashboard
    getFinanceDashboard: builder.query({
      query: () => '/finance/dashboard/',
      providesTags: ['Dashboard'],
    }),

    getFinancialStatements: builder.query({
      query: (params = {}) => ({
        url: '/finance/statements/',
        params,
      }),
      providesTags: ['Ledgers'],
    }),

    getCashFlow: builder.query({
      query: (params = {}) => ({
        url: '/finance/cash-flow/',
        params,
      }),
      providesTags: ['Payments'],
    }),
  }),
});

export const {
  useGetLedgersQuery,
  useGetLedgerQuery,
  useGetLedgerEntriesQuery,
  useCreateLedgerEntryMutation,
  useGetPaymentsQuery,
  useGetPaymentQuery,
  useCreatePaymentMutation,
  useUpdatePaymentMutation,
  useApprovePaymentMutation,
  useProcessPaymentMutation,
  useGetBankStatementsQuery,
  useGetBankStatementQuery,
  useImportBankStatementMutation,
  useReconcileBankStatementMutation,
  useGetCreditDebitNotesQuery,
  useGetCreditDebitNoteQuery,
  useCreateCreditDebitNoteMutation,
  useApproveCreditDebitNoteMutation,
  useGetPettyCashQuery,
  useGetPettyCashRecordQuery,
  useCreatePettyCashVoucherMutation,
  useApprovePettyCashVoucherMutation,
  useGetGSTReturnsQuery,
  useGetGSTReturnQuery,
  useGenerateGSTReturnMutation,
  useGetGSTLiabilityQuery,
  useGetFinanceDashboardQuery,
  useGetFinancialStatementsQuery,
  useGetCashFlowQuery,
} = financeApi;
