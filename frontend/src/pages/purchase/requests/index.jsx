import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel, { applyAdvancedFilters } from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import ActionButtons from '../../../components/common/ActionButtons';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';
import toast from 'react-hot-toast';

export default function PurchaseRequestList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/requests/');
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const [advancedRules, setAdvancedRules] = useState([]);
  const [advancedLogic, setAdvancedLogic] = useState('AND');

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase request?')) return;
    try {
      await apiClient.delete(`/api/purchase/requests/${id}/`);
      toast.success('Purchase request deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search PRs...' },
    {
      key: 'approval_status', label: 'Status', type: 'select',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'EDITED', label: 'Edited' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'pr_no', label: 'PR Number', sortable: true, filterType: 'text' },
    { key: 'warehouse_name', label: 'Warehouse', sortable: true, filterType: 'text' },
    { key: 'priority', label: 'Priority', sortable: true, filterType: 'select', filterOptions: [
      { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' },
    ]},
    { key: 'required_by_date', label: 'Required By', sortable: true, filterType: 'date', render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    {
      key: 'approval_status', label: 'Status', sortable: true, filterType: 'select',
      filterOptions: [
        { value: 'DRAFT', label: 'Draft' }, { value: 'EDITED', label: 'Edited' },
        { value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' },
      ],
      render: (value) => <StatusBadge status={value || 'DRAFT'} />,
    },
    { key: 'request_date', label: 'Created', sortable: true, filterType: 'date', render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'linked_rfq_no', label: 'Linked RFQ', filterType: 'text', render: (value) => value || '-' },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (value, row) => (
        <ActionButtons moduleName="Purchase Request" editPath={`/purchase/requests/${row.id}`} onDelete={() => handleDelete(row.id)} row={row} />
      ),
    },
  ];

  // Apply simple filters
  let filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const s = filterValues.search.toLowerCase();
      const match = [row.pr_no, row.warehouse_name, row.priority].some(v => String(v || '').toLowerCase().includes(s));
      if (!match) return false;
    }
    if (filterValues.approval_status && row.approval_status !== filterValues.approval_status) return false;
    if (filterValues.date_from && row.request_date < filterValues.date_from) return false;
    if (filterValues.date_to && row.request_date > filterValues.date_to) return false;
    return true;
  });

  // Apply advanced filters on top
  if (advancedRules.length > 0) {
    filteredData = applyAdvancedFilters(filteredData, advancedRules, advancedLogic);
  }

  return (
    <MainLayout>
      <PageHeader
        title="Purchase Requests"
        subtitle="Manage purchase requests and approvals"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Requests' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Purchase Request') ? { createLink: '/purchase/requests/new', createLabel: 'New PR' } : {}),
        }}
      />
      {showFilters && (
        <FilterPanel
          filters={filters}
          values={filterValues}
          onChange={(key, value) => setFilterValues(prev => ({ ...prev, [key]: value }))}
          onReset={() => { setFilterValues({}); setAdvancedRules([]); }}
          onClose={() => setShowFilters(false)}
          columns={columns}
          onAdvancedFilter={(rules, logic) => { setAdvancedRules(rules); setAdvancedLogic(logic); }}
        />
      )}
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        exportFileName="purchase-requests"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/requests/${row.id}`)}
      />
    </MainLayout>
  );
}
