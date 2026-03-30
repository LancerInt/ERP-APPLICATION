import { useState, useEffect, useMemo, Fragment } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Save } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import useApiData from '../../../hooks/useApiData.js';

// All 9 permission fields in display order
const PERM_FIELDS = [
  { key: 'can_view', label: 'View' },
  { key: 'can_create', label: 'Create' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_approve', label: 'Approve' },
  { key: 'can_reject', label: 'Reject' },
  { key: 'can_send_email', label: 'Send Email' },
  { key: 'can_export', label: 'Export' },
  { key: 'can_print', label: 'Print' },
];

// Module grouping for the permission grid
const MODULE_GROUPS = [
  {
    label: 'PURCHASE',
    modules: [
      'Purchase Request', 'RFQ', 'Quote', 'Quote Evaluation',
      'Purchase Order', 'Receipt Advice', 'Freight Advice',
      'Vendor Bill', 'Payment Made', 'Vendor Payment', 'Vendor Credit',
    ],
  },
  {
    label: 'SALES',
    modules: [
      'Customer PO', 'Sales Order', 'Dispatch Challan',
      'Sales Invoice', 'Freight Advice (Outbound)', 'Receivable',
    ],
  },
  {
    label: 'PRODUCTION',
    modules: [
      'BOM Request', 'Work Order', 'Wage Voucher',
      'Material Issue', 'Yield Log',
    ],
  },
  {
    label: 'QUALITY',
    modules: [
      'QC Parameter', 'QC Request', 'QC Lab Job',
      'QC Report', 'Counter Sample',
    ],
  },
  {
    label: 'INVENTORY',
    modules: [
      'Stock Transfer', 'Transfer Receipt', 'Shifting',
      'Job Work Order', 'Job Work DC', 'Job Work Receipt',
      'Sales Return', 'Stock Adjustment',
    ],
  },
  {
    label: 'FINANCE',
    modules: [
      'Vendor Ledger', 'Customer Ledger', 'Payment Advice',
      'Bank Statement', 'Credit/Debit Note', 'GST Report',
      'Petty Cash', 'Freight Ledger', 'Wage Ledger',
    ],
  },
  {
    label: 'HR',
    modules: [
      'Staff', 'Shift', 'Attendance',
      'Leave', 'Overtime', 'Payroll',
    ],
  },
  {
    label: 'MASTERS',
    modules: [
      'Company', 'Warehouse', 'Godown', 'Machinery',
      'Product', 'Service Catalogue', 'Vendor', 'Customer',
      'Transporter', 'Price List', 'Tax Master', 'Template',
    ],
  },
  {
    label: 'ADMIN',
    modules: [
      'Audit Log', 'User Management', 'Role Management',
      'Permission Management',
    ],
  },
];

export default function PermissionManagement() {
  const [selectedRole, setSelectedRole] = useState('');
  const [permissionGrid, setPermissionGrid] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);

  // Fetch roles for dropdown
  const { options: roleOptions } = useLookup('/api/rbac/roles/', {
    labelField: 'name',
    valueField: 'id',
  });

  // Fetch all modules
  const { data: modules, isLoading: modulesLoading } = useApiData('/api/rbac/modules/');

  // Build grouped modules from the flat modules list
  const groupedModules = useMemo(() => {
    if (!modules.length) return [];
    const moduleMap = {};
    modules.forEach(m => { moduleMap[m.name] = m; });

    const groups = [];
    const usedModuleIds = new Set();

    for (const group of MODULE_GROUPS) {
      const rows = [];
      for (const name of group.modules) {
        const mod = moduleMap[name];
        if (mod) {
          rows.push(mod);
          usedModuleIds.add(mod.id);
        }
      }
      if (rows.length > 0) {
        groups.push({ label: group.label, modules: rows });
      }
    }

    // Add any modules not in any group under "OTHER"
    const otherModules = modules.filter(m => !usedModuleIds.has(m.id));
    if (otherModules.length > 0) {
      groups.push({ label: 'OTHER', modules: otherModules });
    }

    return groups;
  }, [modules]);

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
          const row = {
            module_id: mod.id,
            module_name: mod.name,
          };
          for (const f of PERM_FIELDS) {
            row[f.key] = perm?.[f.key] || false;
          }
          return row;
        });
        setPermissionGrid(grid);
      })
      .catch(() => {
        toast.error('Failed to load permissions');
        setPermissionGrid([]);
      })
      .finally(() => setIsLoadingPerms(false));
  }, [selectedRole, modules]);

  const getRow = (moduleId) => permissionGrid.find(r => r.module_id === moduleId);

  const togglePermission = (moduleId, field) => {
    setPermissionGrid(prev =>
      prev.map(row =>
        row.module_id === moduleId
          ? { ...row, [field]: !row[field] }
          : row
      )
    );
  };

  // Toggle all modules for a given permission column
  const handleSelectAllColumn = (field) => {
    const allChecked = permissionGrid.every(row => row[field]);
    setPermissionGrid(prev =>
      prev.map(row => ({ ...row, [field]: !allChecked }))
    );
  };

  // Toggle all permissions for a given module row
  const handleSelectAllRow = (moduleId) => {
    const row = getRow(moduleId);
    if (!row) return;
    const allChecked = PERM_FIELDS.every(f => row[f.key]);
    setPermissionGrid(prev =>
      prev.map(r => {
        if (r.module_id !== moduleId) return r;
        const updated = { ...r };
        for (const f of PERM_FIELDS) {
          updated[f.key] = !allChecked;
        }
        return updated;
      })
    );
  };

  const isRowAllChecked = (moduleId) => {
    const row = getRow(moduleId);
    return row ? PERM_FIELDS.every(f => row[f.key]) : false;
  };

  const isColumnAllChecked = (field) => {
    return permissionGrid.length > 0 && permissionGrid.every(row => row[field]);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const payload = {
        role_id: parseInt(selectedRole, 10),
        permissions: permissionGrid.map(row => {
          const perm = { module_id: row.module_id };
          for (const f of PERM_FIELDS) {
            perm[f.key] = row[f.key];
          }
          return perm;
        }),
      };
      await apiClient.post('/api/rbac/role-permissions/bulk/', payload);
      toast.success('Permissions saved successfully!');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[PermissionManagement] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Role Permission Management"
        subtitle="Manage role-based module permissions with granular action control"
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
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-10 min-w-[200px]">
                        Module
                      </th>
                      <th className="text-center px-2 py-3 font-medium text-slate-500 w-10">
                        All
                      </th>
                      {PERM_FIELDS.map(f => (
                        <th key={f.key} className="text-center px-2 py-3 font-medium text-slate-700 min-w-[70px]">
                          <button
                            type="button"
                            onClick={() => handleSelectAllColumn(f.key)}
                            className="hover:text-primary-600 transition text-xs leading-tight"
                            title={`Toggle all ${f.label}`}
                          >
                            <div>{f.label}</div>
                            <div className="mt-0.5">
                              {isColumnAllChecked(f.key) ? (
                                <Check size={12} className="inline text-green-600" />
                              ) : (
                                <span className="inline-block w-3 h-3 border border-slate-300 rounded-sm" />
                              )}
                            </div>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedModules.map((group) => (
                      <Fragment key={group.label}>
                        {/* Group header row */}
                        <tr className="bg-slate-50">
                          <td
                            colSpan={2 + PERM_FIELDS.length}
                            className="px-4 py-2 font-bold text-xs text-slate-500 tracking-wider uppercase sticky left-0 bg-slate-50"
                          >
                            {group.label}
                          </td>
                        </tr>
                        {/* Module rows */}
                        {group.modules.map((mod) => {
                          const row = getRow(mod.id);
                          if (!row) return null;
                          return (
                            <tr key={mod.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-medium text-slate-800 sticky left-0 bg-white z-10">
                                {mod.name}
                              </td>
                              <td className="text-center px-2 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={isRowAllChecked(mod.id)}
                                  onChange={() => handleSelectAllRow(mod.id)}
                                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                  title="Toggle all permissions for this module"
                                />
                              </td>
                              {PERM_FIELDS.map(f => (
                                <td key={f.key} className="text-center px-2 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={row[f.key]}
                                    onChange={() => togglePermission(mod.id, f.key)}
                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </Fragment>
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
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
