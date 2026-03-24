/**
 * HR module slice with RTK Query endpoints
 */

import { apiSlice } from '../api/apiSlice.js';

export const hrApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Staff
    getStaff: builder.query({
      query: (params = {}) => ({
        url: '/hr/staff/',
        params,
      }),
      providesTags: ['Staff'],
    }),

    getStaffMember: builder.query({
      query: (id) => `/hr/staff/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Staff', id }],
    }),

    createStaff: builder.mutation({
      query: (body) => ({
        url: '/hr/staff/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Staff'],
    }),

    updateStaff: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/hr/staff/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Staff', id }],
    }),

    deactivateStaff: builder.mutation({
      query: (id) => ({
        url: `/hr/staff/${id}/deactivate/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Staff', id }],
    }),

    // Attendance
    getAttendance: builder.query({
      query: (params = {}) => ({
        url: '/hr/attendance/',
        params,
      }),
      providesTags: ['Attendance'],
    }),

    getStaffAttendance: builder.query({
      query: ({ staffId, ...params }) => ({
        url: `/hr/attendance/?staff_id=${staffId}`,
        params,
      }),
      providesTags: (result, error, { staffId }) => [{ type: 'Attendance', staffId }],
    }),

    createAttendance: builder.mutation({
      query: (body) => ({
        url: '/hr/attendance/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Attendance'],
    }),

    updateAttendance: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/hr/attendance/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Attendance', id }],
    }),

    bulkCreateAttendance: builder.mutation({
      query: (body) => ({
        url: '/hr/attendance/bulk-create/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Attendance'],
    }),

    // Leave
    getLeaveRequests: builder.query({
      query: (params = {}) => ({
        url: '/hr/leave-requests/',
        params,
      }),
      providesTags: ['Leave'],
    }),

    getLeaveRequest: builder.query({
      query: (id) => `/hr/leave-requests/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Leave', id }],
    }),

    createLeaveRequest: builder.mutation({
      query: (body) => ({
        url: '/hr/leave-requests/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Leave'],
    }),

    updateLeaveRequest: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/hr/leave-requests/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Leave', id }],
    }),

    approveLeaveRequest: builder.mutation({
      query: (id) => ({
        url: `/hr/leave-requests/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Leave', id }],
    }),

    rejectLeaveRequest: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/hr/leave-requests/${id}/reject/`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Leave', id }],
    }),

    getLeaveBalance: builder.query({
      query: (staffId) => `/hr/leave-balance/?staff_id=${staffId}`,
      providesTags: (result, error, staffId) => [{ type: 'Staff', staffId }],
    }),

    // Overtime
    getOvertimeRequests: builder.query({
      query: (params = {}) => ({
        url: '/hr/overtime-requests/',
        params,
      }),
      providesTags: ['Overtime'],
    }),

    getOvertimeRequest: builder.query({
      query: (id) => `/hr/overtime-requests/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Overtime', id }],
    }),

    createOvertimeRequest: builder.mutation({
      query: (body) => ({
        url: '/hr/overtime-requests/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Overtime'],
    }),

    updateOvertimeRequest: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/hr/overtime-requests/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Overtime', id }],
    }),

    approveOvertimeRequest: builder.mutation({
      query: (id) => ({
        url: `/hr/overtime-requests/${id}/approve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Overtime', id }],
    }),

    // Payroll
    getPayrollRuns: builder.query({
      query: (params = {}) => ({
        url: '/hr/payroll-runs/',
        params,
      }),
      providesTags: ['Payroll'],
    }),

    getPayrollRun: builder.query({
      query: (id) => `/hr/payroll-runs/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Payroll', id }],
    }),

    createPayrollRun: builder.mutation({
      query: (body) => ({
        url: '/hr/payroll-runs/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Payroll'],
    }),

    getPayslip: builder.query({
      query: (staffId) => `/hr/payslips/?staff_id=${staffId}`,
      providesTags: (result, error, staffId) => [{ type: 'Payroll', staffId }],
    }),

    generatePayslip: builder.mutation({
      query: ({ staffId, ...body }) => ({
        url: `/hr/payslips/?staff_id=${staffId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Payroll'],
    }),

    processPayroll: builder.mutation({
      query: (payrollRunId) => ({
        url: `/hr/payroll-runs/${payrollRunId}/process/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, payrollRunId) => [{ type: 'Payroll', payrollRunId }],
    }),

    // HR Dashboard
    getHRDashboard: builder.query({
      query: () => '/hr/dashboard/',
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetStaffQuery,
  useGetStaffMemberQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useDeactivateStaffMutation,
  useGetAttendanceQuery,
  useGetStaffAttendanceQuery,
  useCreateAttendanceMutation,
  useUpdateAttendanceMutation,
  useBulkCreateAttendanceMutation,
  useGetLeaveRequestsQuery,
  useGetLeaveRequestQuery,
  useCreateLeaveRequestMutation,
  useUpdateLeaveRequestMutation,
  useApproveLeaveRequestMutation,
  useRejectLeaveRequestMutation,
  useGetLeaveBalanceQuery,
  useGetOvertimeRequestsQuery,
  useGetOvertimeRequestQuery,
  useCreateOvertimeRequestMutation,
  useUpdateOvertimeRequestMutation,
  useApproveOvertimeRequestMutation,
  useGetPayrollRunsQuery,
  useGetPayrollRunQuery,
  useCreatePayrollRunMutation,
  useGetPayslipQuery,
  useGeneratePayslipMutation,
  useProcessPayrollMutation,
  useGetHRDashboardQuery,
} = hrApi;
