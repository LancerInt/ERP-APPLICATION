import { useState } from 'react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function AttendanceDashboard() {
  const { data, isLoading, error } = useApiData('/api/hr/attendance/');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const handleCheckIn = (staff) => {
    // In production, this would request geolocation permission
    setSelectedStaff(staff);
    setShowGeoModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-50 border-green-200';
      case 'ABSENT':
        return 'bg-red-50 border-red-200';
      case 'LATE':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const staffData = data || [];
  const present = staffData.filter((s) => s.status === 'PRESENT').length;
  const absent = staffData.filter((s) => s.status === 'ABSENT').length;
  const late = staffData.filter((s) => s.status === 'LATE').length;

  const breadcrumbs = [
    { label: 'HR', href: '#' },
    { label: 'Attendance' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Attendance</h1>
            <p className="text-slate-600 mt-2">Geo-fenced attendance tracking</p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-600 font-medium">Total Staff</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{staffData.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-green-200 p-6">
            <p className="text-sm text-green-600 font-medium">Present</p>
            <p className="text-3xl font-bold text-green-900 mt-2">{present}</p>
          </div>
          <div className="bg-white rounded-lg border border-red-200 p-6">
            <p className="text-sm text-red-600 font-medium">Absent</p>
            <p className="text-3xl font-bold text-red-900 mt-2">{absent}</p>
          </div>
          <div className="bg-white rounded-lg border border-yellow-200 p-6">
            <p className="text-sm text-yellow-600 font-medium">Late</p>
            <p className="text-3xl font-bold text-yellow-900 mt-2">{late}</p>
          </div>
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffData.map((staff) => (
            <div
              key={staff.id}
              className={`rounded-lg border p-6 ${getStatusColor(staff.status)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{staff.name}</h3>
                  <p className="text-sm text-slate-600">{staff.employeeId}</p>
                </div>
                <StatusBadge status={staff.status} />
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-600 uppercase font-medium">Department</p>
                  <p className="text-slate-900 font-medium mt-1">{staff.department}</p>
                </div>

                {staff.checkInTime && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-medium">Check In</p>
                    <p className="text-slate-900 font-medium mt-1">{staff.checkInTime}</p>
                  </div>
                )}

                {staff.checkOutTime && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-medium">Check Out</p>
                    <p className="text-slate-900 font-medium mt-1">{staff.checkOutTime}</p>
                  </div>
                )}

                {!staff.checkInTime && (
                  <button
                    onClick={() => handleCheckIn(staff)}
                    className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Check In
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Geo Modal */}
        {showGeoModal && (
          <>
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Verify Location
                  </h2>
                </div>

                <div className="p-6">
                  <p className="text-slate-600 mb-4">
                    Please allow location access to verify you are at the workplace.
                  </p>
                  <div className="bg-slate-100 rounded-lg p-4 text-center mb-6">
                    <p className="text-sm text-slate-600">
                      📍 Current Location
                    </p>
                    <p className="text-slate-900 font-semibold mt-2">
                      {selectedStaff?.latitude?.toFixed(4)},{' '}
                      {selectedStaff?.longitude?.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setShowGeoModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      console.log('Check-in confirmed for:', selectedStaff?.name);
                      setShowGeoModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                  >
                    Confirm Check In
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
