import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function QCParameterList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/quality/params/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search parameters...' },
    {
      key: 'critical_flag',
      label: 'Critical',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
    },
  ];

  const columns = [
    { key: 'parameter_code', label: 'Parameter Code', sortable: true },
    { key: 'parameter_name', label: 'Parameter Name', sortable: true },
    { key: 'test_method', label: 'Test Method', sortable: true },
    {
      key: 'critical_flag',
      label: 'Critical',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value === 'Yes'
              ? 'bg-red-100 text-red-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {value}
        </span>
      ),
    },
    { key: 'applicable_template', label: 'Applicable Template', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value === false ? 'Inactive' : (value === true ? 'Active' : value)} />,
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.parameter_code.toLowerCase().includes(search) ||
        row.parameter_name.toLowerCase().includes(search) ||
        row.test_method.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.critical_flag && row.critical_flag !== filterValues.critical_flag) return false;
    if (filterValues.status && (row.is_active ? 'Active' : 'Inactive') !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="QC Parameter Library"
        subtitle="Manage quality control parameters and test methods"
        breadcrumbs={[{ label: 'Quality', href: '/quality' }, { label: 'Parameters' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting QC parameters...'),
          createLink: '/quality/params/new',
          createLabel: 'New Parameter',
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
        onRowClick={(row) => navigate(`/quality/params/${row.id}`)}
      />
    </MainLayout>
  );
}
