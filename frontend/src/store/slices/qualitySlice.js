/**
 * Quality module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const qualityApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // QC Requests
    getQCRequests: builder.query({
      query: (params = {}) => ({
        url: '/quality/qc-requests/',
        params,
      }),
      providesTags: ['QCRequests'],
    }),

    getQCRequest: builder.query({
      query: (id) => `/quality/qc-requests/${id}/`,
      providesTags: (result, error, id) => [{ type: 'QCRequests', id }],
    }),

    createQCRequest: builder.mutation({
      query: (body) => ({
        url: '/quality/qc-requests/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['QCRequests'],
    }),

    updateQCRequest: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/quality/qc-requests/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'QCRequests', id }],
    }),

    assignQCRequest: builder.mutation({
      query: ({ id, inspector_id }) => ({
        url: `/quality/qc-requests/${id}/assign/`,
        method: 'POST',
        body: { inspector_id },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'QCRequests', id }],
    }),

    submitQCResult: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/quality/qc-requests/${id}/submit-result/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'QCRequests', id }],
    }),

    // Lab Jobs
    getLabJobs: builder.query({
      query: (params = {}) => ({
        url: '/quality/lab-jobs/',
        params,
      }),
      providesTags: ['LabJobs'],
    }),

    getLabJob: builder.query({
      query: (id) => `/quality/lab-jobs/${id}/`,
      providesTags: (result, error, id) => [{ type: 'LabJobs', id }],
    }),

    createLabJob: builder.mutation({
      query: (body) => ({
        url: '/quality/lab-jobs/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['LabJobs'],
    }),

    updateLabJob: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/quality/lab-jobs/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'LabJobs', id }],
    }),

    completeLabJob: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/quality/lab-jobs/${id}/complete/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'LabJobs', id }],
    }),

    // QC Reports
    getQCReports: builder.query({
      query: (params = {}) => ({
        url: '/quality/reports/',
        params,
      }),
      providesTags: ['QCReports'],
    }),

    getQCReport: builder.query({
      query: (id) => `/quality/reports/${id}/`,
      providesTags: (result, error, id) => [{ type: 'QCReports', id }],
    }),

    // Counter Samples
    getCounterSamples: builder.query({
      query: (params = {}) => ({
        url: '/quality/counter-samples/',
        params,
      }),
      providesTags: ['CounterSamples'],
    }),

    getCounterSample: builder.query({
      query: (id) => `/quality/counter-samples/${id}/`,
      providesTags: (result, error, id) => [{ type: 'CounterSamples', id }],
    }),

    createCounterSample: builder.mutation({
      query: (body) => ({
        url: '/quality/counter-samples/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CounterSamples'],
    }),

    submitCounterSample: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/quality/counter-samples/${id}/submit/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'CounterSamples', id }],
    }),

    // QC Dashboard
    getQCDashboard: builder.query({
      query: () => '/quality/dashboard/',
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetQCRequestsQuery,
  useGetQCRequestQuery,
  useCreateQCRequestMutation,
  useUpdateQCRequestMutation,
  useAssignQCRequestMutation,
  useSubmitQCResultMutation,
  useGetLabJobsQuery,
  useGetLabJobQuery,
  useCreateLabJobMutation,
  useUpdateLabJobMutation,
  useCompleteLabJobMutation,
  useGetQCReportsQuery,
  useGetQCReportQuery,
  useGetCounterSamplesQuery,
  useGetCounterSampleQuery,
  useCreateCounterSampleMutation,
  useSubmitCounterSampleMutation,
  useGetQCDashboardQuery,
} = qualityApi;
