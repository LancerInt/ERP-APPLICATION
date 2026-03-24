import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import useApiData from '../../../hooks/useApiData.js';

export default function PermissionManagement() {
  const [selectedRole, setSelectedRole] = useState('');
  const [permissionGrid, setPermissionGrid] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editGrid, setEditGrid] = useState({});

  // Fetch roles for dropdown
  const { options: roleOptions, raw: rolesRaw } = useLookup('/api/rbac/roles/', {
    labelField: 'name',
    valueField: 'id',
  });

  // Fetch all modules
  const { data: modules, isLoading: modulesLoading } = useApiData('/api/rbac/modules/');

  // Fetch ALL role-permission records for the "Current Permissions" table
  const { data: rawAllPerms, isLoading: allPermsLoading, refetch: refetchAllPerms } = useApiData('/api/rbac/role-permissions/?page_size=2000');

  // Filter: only show records where at least one permission is granted
  const [permFilterRole, setPermFilterRole] = useState('');
  const allRolePerms = (rawAllPerms || []).filter(p => {
    const hasAnyPerm = p.can_view || p.can_create || p.can_edit || p.can_delete;
    if (!hasAnyPerm) return false;
    if (permFilterRole && String(p.role) !== String(permFilterRole) && p.role_name !== permFilterRole) return false;
    return true;
  });

  // Fetch permissions when role is selected
  useEffect(() => {
    if (!selectedRole || !modules.length) return;

    setIsLoadingPerms(true);
    apiClient.get(`/api/rbac/role-permissions/?role=${selectedRole}`)
      .then(res => {
        const rolePerms = res.data?.results || res.data || [];
        // Build grid: one row per module with current permission state
        const grid = modules.map(mod => {
          const perm = rolePerms.find(p =>
            String(p.module) === String(mod.id) ||
            String(p.module_id) === String(mod.id) ||
            p.module_name === mod.name
          );
          return {
            module_id: mod.id,
            module_name: mod.name,
            can_view: perm?.can_view || false,
            can_create: perm?.can_create || false,
            can_edit: perm?.can_edit || false,
            can_delete: perm?.can_delete || false,
          };
        });
        setPermissionGrid(grid);
      })
      .catch(() => {
        toast.error('Failed to load permissions');
        setPermissionGrid([]);
      })
      .finally(() => setIsLoadingPerms(false));
  }, [selectedRole, modules]);

  const togglePermission = (moduleId, field) => {
    setPermissionGrid(prev =>
      prev.map(row =>
        row.module_id === moduleId
          ? { ...row, [field]: !row[field] }
          : row
      )
    );
  };

  const handleSelectAll = (field) => {
    const allChecked = permissionGrid.every(row => row[field]);
    setPermissionGrid(prev =>
      prev.map(row => ({ ...row, [field]: !allChecked }))
    );
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const payload = {
        role_id: parseInt(selectedRole, 10),
        permissions: permissionGrid.map(row => ({
          module_id: row.module_id,
          can_view: row.can_view,
          can_create: row.can_create,
          can_edit: row.can_edit,
          can_delete: row.can_delete,
        })),
      };
      await apiClient.post('/api/rbac/role-permissions/bulk/', payload);
      toast.success('Permissions saved successfully!');
      refetchAllPerms();
    } catch (error) {
      if (import.meta.env.DEV) console.error('[PermissionManagement] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  // --- Current Permissions table handlers ---
  const handleDeleteRecord = async (record) => {
    if (!window.confirm(`Delete permission for role "${record.role_name || record.role}" on module "${record.module_name || record.module}"?`)) return;
    try {
      await apiClient.delete(`/api/rbac/role-permissions/${record.id}/`);
      toast.success('Permission record deleted');
      refetchAllPerms();
    } catch (err) {
      toast.error('Failed to delete permission record');
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record.id);
    setEditGrid({
      can_view: record.can_view,
      can_create: record.can_create,
      can_edit: record.can_edit,
      can_delete: record.can_delete,
    });
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditGrid({});
  };

  const handleSaveEdit = async (record) => {
    try {
      await apiClient.put(`/api/rbac/role-permissions/${record.id}/`, {
        role: record.role_id || record.role,
        module: record.module_id || record.module,
        ...editGrid,
      });
      toast.success('Permission updated');
      setEditingRecord(null);
      setEditGrid({});
      refetchAllPerms();
    } catch (err) {
      toast.error('Failed to update permission');
    }
  };

  // Helper to get role name from record
  const getRoleName = (record) => {
    if (record.role_name) return record.role_name;
    if (typeof record.role === 'object' && record.role?.name) return record.role.name;
    const found = rolesRaw.find(r => String(r.id) === String(record.role || record.role_id));
    return found?.name || record.role || '';
  };

  // Helper to get module name from record
  const getModuleName = (record) => {
    if (record.module_name) return record.module_name;
    if (typeof record.module === 'object' && record.module?.name) return record.module.name;
    const found = modules.find(m => String(m.id) === String(record.module || record.module_id));
    return found?.name || record.module || '';
  };

  return (
    <MainLayout>
      <PageHeader
        title="Permission Management"
        subtitle="Manage role-based module permissions"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Permissions' }]}
      />

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        {/* Role Selector */}
        <div className="max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Role</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select a role...</option>
            {roleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Permission Grid */}
        {selectedRole && (
          <>
            {(modulesLoading || isLoadingPerms) ? (
              <div className="text-center py-8 text-slate-500">Loading permissions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Module</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-700">
                        <button
                          type="button"
                          onClick={() => handleSelectAll('can_view')}
                          className="hover:text-primary-600 transition"
                        >
                          View
                        </button>
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-slate-700">
                        <button
                          type="button"
                          onClick={() => handleSelectAll('can_create')}
                          className="hover:text-primary-600 transition"
                        >
                          Create
                        </button>
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-slate-700">
                        <button
                          type="button"
                          onClick={() => handleSelectAll('can_edit')}
                          className="hover:text-primary-600 transition"
                        >
                          Edit
                        </button>
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-slate-700">
                        <button
                          type="button"
                          onClick={() => handleSelectAll('can_delete')}
                          className="hover:text-primary-600 transition"
                        >
                          Delete
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionGrid.map((row) => (
                      <tr key={row.module_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.module_name}</td>
                        <td className="text-center px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.can_view}
                            onChange={() => togglePermission(row.module_id, 'can_view')}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="text-center px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.can_create}
                            onChange={() => togglePermission(row.module_id, 'can_create')}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="text-center px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.can_edit}
                            onChange={() => togglePermission(row.module_id, 'can_edit')}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="text-center px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.can_delete}
                            onChange={() => togglePermission(row.module_id, 'can_delete')}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Current Permissions Table */}
      <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Current Permissions</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Filter by role:</label>
            <select
              value={permFilterRole}
              onChange={(e) => setPermFilterRole(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Roles</option>
              {roleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="text-sm text-slate-500">{allRolePerms.length} records</span>
          </div>
        </div>
        {allPermsLoading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Module</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-700">View</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-700">Create</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-700">Edit</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-700">Delete</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(allRolePerms || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">No permission records found</td>
                  </tr>
                ) : (
                  (allRolePerms || []).map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{getRoleName(record)}</td>
                      <td className="px-4 py-3 text-slate-700">{getModuleName(record)}</td>
                      {editingRecord === record.id ? (
                        <>
                          <td className="text-center px-4 py-3">
                            <input type="checkbox" checked={editGrid.can_view} onChange={() => setEditGrid(g => ({ ...g, can_view: !g.can_view }))} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          </td>
                          <td className="text-center px-4 py-3">
                            <input type="checkbox" checked={editGrid.can_create} onChange={() => setEditGrid(g => ({ ...g, can_create: !g.can_create }))} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          </td>
                          <td className="text-center px-4 py-3">
                            <input type="checkbox" checked={editGrid.can_edit} onChange={() => setEditGrid(g => ({ ...g, can_edit: !g.can_edit }))} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          </td>
                          <td className="text-center px-4 py-3">
                            <input type="checkbox" checked={editGrid.can_delete} onChange={() => setEditGrid(g => ({ ...g, can_delete: !g.can_delete }))} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                          </td>
                          <td className="text-center px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleSaveEdit(record)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Save">
                                <Check size={16} />
                              </button>
                              <button onClick={handleCancelEdit} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Cancel">
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="text-center px-4 py-3">
                            {record.can_view ? <Check size={16} className="inline text-green-600" /> : <X size={16} className="inline text-red-400" />}
                          </td>
                          <td className="text-center px-4 py-3">
                            {record.can_create ? <Check size={16} className="inline text-green-600" /> : <X size={16} className="inline text-red-400" />}
                          </td>
                          <td className="text-center px-4 py-3">
                            {record.can_edit ? <Check size={16} className="inline text-green-600" /> : <X size={16} className="inline text-red-400" />}
                          </td>
                          <td className="text-center px-4 py-3">
                            {record.can_delete ? <Check size={16} className="inline text-green-600" /> : <X size={16} className="inline text-red-400" />}
                          </td>
                          <td className="text-center px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleEditRecord(record)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleDeleteRecord(record)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
