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

export default function FreightAdviceInboundList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/freight/');
  const { canCreate, canExport } = usePermissions();
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
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'IN_TRANSIT', label: 'In Transit' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'PAID', label: 'Paid' },
        { value: 'CANCELLED', label: 'Cancelled' },
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
    {
      key: 'freight_terms',
      label: 'Freight Terms',
      type: 'select',
      options: [
        { value: 'PAID', label: 'Paid' },
        { value: 'TO_PAY', label: 'To Pay' },
      ],
    },
  ];

  const columns = [
    { key: 'advice_no', label: 'Freight No', sortable: true },
    { key: 'receipt_advice_no', label: 'Receipt Advice', sortable: true },
    { key: 'transporter_name', label: 'Transporter', sortable: true },
    { key: 'freight_type', label: 'Freight Type', sortable: true },
    {
      key: 'freight_terms_display',
      label: 'Terms',
      sortable: true,
      render: (value) => value || '-',
    },
    {
      key: 'total_freight_cost',
      label: 'Total Amount',
      sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN')}` : '-',
    },
    {
      key: 'status_display',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value || row.status} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/freight/${row.id}`); }}
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
      const matchesSearch = [
        row.advice_no, row.receipt_advice_no, row.transporter_name,
        row.freight_type, row.status_display, row.vendor_name,
      ].some((v) => String(v || '').toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }
    if (filterValues.transporter) {
      const transporterSearch = filterValues.transporter.toLowerCase();
      if (!String(row.transporter_name || '').toLowerCase().includes(transporterSearch)) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    if (filterValues.freight_type && row.freight_type !== filterValues.freight_type) {
      return false;
    }
    if (filterValues.freight_terms && row.freight_terms !== filterValues.freight_terms) {
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
          { label: 'Purchase', href: '/purchase' },
          { label: 'Freight Advice (Inbound)' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: canExport('Freight Advice') ? () => {} : undefined,
          ...(canCreate('Freight Advice') ? { createLink: '/purchase/freight/new', createLabel: 'New Freight Advice' } : {}),
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
        exportFileName="freight-advices"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/freight/${row.id}`)}
      />
    </MainLayout>
  );
}
