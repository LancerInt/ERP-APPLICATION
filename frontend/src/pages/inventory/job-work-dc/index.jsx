import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function JobWorkDCList() {
  const { data, isLoading, error } = useApiData('/api/inventory/job-work-dc/');
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search job work DCs...' },
    { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'Search vendor...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Dispatched', label: 'Dispatched' },
        { value: 'Delivered', label: 'Delivered' },
      ],
    },
  ];

  const columns = [
    { key: 'jw_dc_no', label: 'JW DC No', sortable: true },
    { key: 'job_work_order', label: 'Job Work Order', sortable: true },
    { key: 'vendor', label: 'Vendor', sortable: true },
    { key: 'transporter', label: 'Transporter', sortable: true },
    {
      key: 'dispatch_date',
      label: 'Dispatch Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'total_qty', label: 'Total Qty', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
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
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Job Work DC"
        subtitle="Manage job work delivery challans"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Job Work DC' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/inventory/job-work-dc/new',
          createLabel: 'New JW DC',
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
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/inventory/job-work-dc/${row.id}`)}
      />
    </MainLayout>
  );
}
