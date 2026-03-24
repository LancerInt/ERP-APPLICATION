import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ClipboardList,
  ShoppingCart,
  TrendingDown,
  Factory,
  Activity,
  Plus,
} from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import StatsCard from '../../components/common/StatsCard';
import DataTable from '../../components/common/DataTable';

// Mock API hooks - replace with RTK Query
const useDashboardStats = () => {
  const [data, setData] = useState({
    pendingApprovals: 12,
    openPOs: 45,
    overdueReceivables: 234560,
    activeWorkOrders: 8,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch from API
    setIsLoading(false);
  }, []);

  return { data, isLoading };
};

const useRecentActivity = () => {
  const [data, setData] = useState([
    {
      id: 1,
      type: 'PO_CREATED',
      title: 'Purchase Order PO-001 created',
      timestamp: '2 hours ago',
      user: 'John Doe',
    },
    {
      id: 2,
      type: 'PR_APPROVED',
      title: 'Purchase Request PR-005 approved',
      timestamp: '4 hours ago',
      user: 'Jane Smith',
    },
    {
      id: 3,
      type: 'INVOICE_PAID',
      title: 'Invoice INV-2024-001 marked as paid',
      timestamp: '1 day ago',
      user: 'Admin',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  return { data, isLoading };
};

export default function Dashboard() {
  const userRole = useSelector((state) => state.auth?.user?.role);
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activities, isLoading: activitiesLoading } = useRecentActivity();

  const breadcrumbs = [{ label: 'Dashboard' }];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={ClipboardList}
            label="Pending Approvals"
            value={stats.pendingApprovals}
            trend={15}
            trendLabel="vs last week"
            isLoading={statsLoading}
            onClick={() => window.location.href = '/purchase/requests?status=PENDING'}
          />
          <StatsCard
            icon={ShoppingCart}
            label="Open Purchase Orders"
            value={stats.openPOs}
            trend={-5}
            trendLabel="vs last week"
            isLoading={statsLoading}
            onClick={() => window.location.href = '/purchase/orders'}
          />
          <StatsCard
            icon={TrendingDown}
            label="Overdue Receivables"
            value={`₹${stats.overdueReceivables.toLocaleString()}`}
            trend={25}
            trendLabel="vs last month"
            isLoading={statsLoading}
            onClick={() => window.location.href = '/sales/receivables'}
          />
          <StatsCard
            icon={Factory}
            label="Active Work Orders"
            value={stats.activeWorkOrders}
            trend={0}
            trendLabel="vs yesterday"
            isLoading={statsLoading}
            onClick={() => window.location.href = '/production/work-orders'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <a
                  href="/purchase/requests/new"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-blue-50 transition"
                >
                  <Plus size={18} className="text-blue-600" />
                  <span className="text-sm font-medium">New Purchase Request</span>
                </a>
                <a
                  href="/sales/orders/new"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-blue-50 transition"
                >
                  <Plus size={18} className="text-blue-600" />
                  <span className="text-sm font-medium">New Sales Order</span>
                </a>
                {userRole === 'HR' && (
                  <a
                    href="/hr/attendance"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-blue-50 transition"
                  >
                    <Plus size={18} className="text-blue-600" />
                    <span className="text-sm font-medium">Mark Attendance</span>
                  </a>
                )}
              </div>
            </div>

            {/* Chart Placeholder */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Monthly Trend
              </h3>
              <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Activity size={32} />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Recent Activity
              </h3>
              {activitiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-4 pb-4 border-b border-slate-200 last:border-b-0 last:pb-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Activity size={16} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {activity.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          by {activity.user}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {activity.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
