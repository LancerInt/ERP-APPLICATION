import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function JobWorkReceiptList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/inventory/job-work-receipts/');
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search JW receipts...' },
    { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'Search vendor...' },
    {
      key: 'qc_status',
      label: 'QC Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Passed', label: 'Passed' },
        { value: 'Failed', label: 'Failed' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Received', label: 'Received' },
        { value: 'Completed', label: 'Completed' },
      ],
    },
  ];

  const columns = [
    { key: 'jw_receipt_no', label: 'JW Receipt No', sortable: true },
    { key: 'job_work_order', label: 'Job Work Order', sortable: true },
    { key: 'vendor', label: 'Vendor', sortable: true },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'received_qty', label: 'Received Qty', sortable: true },
    {
      key: 'qc_status',
      label: 'QC Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/inventory/job-work-receipts/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.vendor) {
      const vendorSearch = filterValues.vendor.toLowerCase();
      if (!row.vendor.toLowerCase().includes(vendorSearch)) return false;
    }
    if (filterValues.qc_status && row.qc_status !== filterValues.qc_status) {
      return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Job Work Receipts"
        subtitle="Manage job work receipt records"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Job Work Receipts' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Job Work') ? { createLink: '/inventory/job-work-receipts/new', createLabel: 'New JW Receipt' } : {}),
        }}
      />
      {showFilters && (
        <FilterPanel
          filters={filters}
          values={filterValues}
          onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilterValues({})}
          onClose={() => setShowFilters(false)}
        />
      )}
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        exportFileName="job-work-receipts"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/inventory/job-work-receipts/${row.id}`)}
      />
    </MainLayout>
  );
}
