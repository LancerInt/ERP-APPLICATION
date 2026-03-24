import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function FreightAdviceInboundList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/freight/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search freight advice...' },
    { key: 'transporter', label: 'Transporter', type: 'text', placeholder: 'Filter by transporter...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Approved', label: 'Approved' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
    {
      key: 'freight_type',
      label: 'Freight Type',
      type: 'select',
      options: [
        { value: 'Local Drayage', label: 'Local Drayage' },
        { value: 'Linehaul', label: 'Linehaul' },
      ],
    },
  ];

  const columns = [
    { key: 'freight_no', label: 'Freight No', sortable: true },
    { key: 'receipt_advice', label: 'Receipt Advice', sortable: true },
    { key: 'transporter', label: 'Transporter', sortable: true },
    { key: 'freight_type', label: 'Freight Type', sortable: true },
    {
      key: 'total_amount',
      label: 'Total Amount',
      sortable: true,
      render: (value) => value ? `₹${Number(value).toLocaleString()}` : '-',
    },
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
    if (filterValues.transporter) {
      const transporterSearch = filterValues.transporter.toLowerCase();
      if (!row.transporter.toLowerCase().includes(transporterSearch)) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    if (filterValues.freight_type && row.freight_type !== filterValues.freight_type) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Freight Advice (Inbound)"
        subtitle="Manage inbound freight and transportation charges"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Purchase', href: '/purchase' },
          { label: 'Freight Advice (Inbound)' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/freight/new',
          createLabel: 'New Freight Advice',
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
        onRowClick={(row) => navigate(`/purchase/freight/${row.id}`)}
      />
    </MainLayout>
  );
}
