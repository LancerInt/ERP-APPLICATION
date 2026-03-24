import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import useApiData from '../../../hooks/useApiData.js';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';

export default function EmailTemplateList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/communications/templates/');
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the template "${name}"?`)) return;
    setDeleting(id);
    try {
      await apiClient.delete(`/api/communications/templates/${id}/`);
      toast.success('Template deleted successfully');
      refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    {
      key: 'is_default',
      label: 'Default',
      render: (value) => (
        value ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Yes</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">No</span>
        )
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/email-templates/${row.id}/edit`); }}
            className="px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.name); }}
            disabled={deleting === row.id}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            {deleting === row.id ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Email Templates"
        subtitle="Manage email templates for RFQ and communications"
        breadcrumbs={[
          { label: 'Admin' },
          { label: 'Email Templates' },
        ]}
        actions={{
          createLink: '/admin/email-templates/new',
          createLabel: 'Create Template',
        }}
      />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        columns={columns}
        data={data || []}
        onRowClick={(row) => navigate(`/admin/email-templates/${row.id}/edit`)}
      />
    </MainLayout>
  );
}
