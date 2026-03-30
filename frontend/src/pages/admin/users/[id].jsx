import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import useLookup from '../../../hooks/useLookup.js';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { options: roleOptions } = useLookup('/api/rbac/roles/');

  const fetchUser = () => {
    apiClient.get(`/api/rbac/users/${id}/`)
      .then(res => { setUser(res.data); setEditData(res.data); })
      .catch(() => toast.error('Failed to load user'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchUser(); }, [id]);

  const handleEdit = () => { setIsEditing(true); setEditData({ ...user }); };
  const handleCancel = () => { setIsEditing(false); setEditData({ ...user }); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        email: editData.email || '',
        first_name: editData.first_name || '',
        last_name: editData.last_name || '',
        is_active: editData.is_active,
      };
      // Include role_id if changed
      const currentRoleId = user.role?.id;
      const newRoleId = editData.role_id || (typeof editData.role === 'object' ? editData.role?.id : editData.role);
      if (newRoleId && String(newRoleId) !== String(currentRoleId)) {
        payload.role_id = newRoleId;
      }
      const res = await apiClient.patch(`/api/rbac/users/${id}/`, payload);
      setUser(res.data);
      setIsEditing(false);
      toast.success('User updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    const newPassword = window.prompt('Enter new password:');
    if (!newPassword) return;
    try {
      await apiClient.patch(`/api/rbac/users/${id}/`, { password: newPassword });
      toast.success('Password reset successfully');
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div></MainLayout>;
  if (!user) return <MainLayout><div className="text-center py-20 text-red-500">User not found</div></MainLayout>;

  const roleName = typeof user.role === 'object' ? user.role?.name : user.role || 'No role';
  const roleId = typeof user.role === 'object' ? user.role?.id : user.role;
  const permissions = user.permissions || [];
  const viewPerms = permissions.filter(p => p.can_view).length;

  return (
    <MainLayout>
      <PageHeader
        title={`User: ${user.username}`}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: user.username },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Info */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{(user.username || '?')[0].toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{user.first_name || user.last_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}</h2>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    <button onClick={handleEdit} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Edit</button>
                    <button onClick={handleResetPassword} className="px-4 py-2 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100">Reset Password</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleCancel} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">Username</label>
                <p className="font-medium text-slate-800">{user.username}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">Email</label>
                {isEditing ? (
                  <input type="email" name="email" value={editData.email || ''} onChange={handleChange} className={inputClass} placeholder="Enter email" />
                ) : (
                  <p className="font-medium text-slate-800">{user.email || <span className="text-slate-400 italic">Not set</span>}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">First Name</label>
                {isEditing ? (
                  <input type="text" name="first_name" value={editData.first_name || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="font-medium text-slate-800">{user.first_name || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">Last Name</label>
                {isEditing ? (
                  <input type="text" name="last_name" value={editData.last_name || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="font-medium text-slate-800">{user.last_name || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">Role</label>
                {isEditing ? (
                  <select name="role_id" value={editData.role_id || roleId || ''} onChange={handleChange} className={inputClass}>
                    <option value="">No Role</option>
                    {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <p className="font-medium text-primary-700 cursor-pointer hover:underline" onClick={() => roleId && navigate(`/admin/roles/${roleId}`)}>
                    {roleName}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">Status</label>
                {isEditing ? (
                  <label className="flex items-center gap-2 mt-1">
                    <input type="checkbox" name="is_active" checked={editData.is_active} onChange={handleChange} className="rounded" />
                    <span className="text-sm">{editData.is_active ? 'Active' : 'Inactive'}</span>
                  </label>
                ) : (
                  <StatusBadge status={user.is_active ? 'Active' : 'Inactive'} />
                )}
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Permissions (via Role: {roleName})</h3>
              <button onClick={() => navigate('/admin/permissions')} className="text-sm text-primary-600 hover:underline">Edit Permissions</button>
            </div>
            {permissions.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No permissions assigned. Assign a role to grant permissions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-50">Module</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">View</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Create</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Edit</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Delete</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Approve</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Reject</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Email</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Export</th>
                      <th className="text-center px-2 py-2 text-[11px] uppercase text-slate-500">Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.filter(p => p.can_view || p.can_create || p.can_edit || p.can_delete || p.can_approve).map(p => (
                      <tr key={p.module_name} className="border-b border-slate-50">
                        <td className="px-3 py-1.5 font-medium text-slate-700 sticky left-0 bg-white">{p.module_name}</td>
                        {['can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_reject', 'can_send_email', 'can_export', 'can_print'].map(k => (
                          <td key={k} className="text-center px-2 py-1.5">
                            {p[k] ? (
                              <span className="text-green-500">✓</span>
                            ) : (
                              <span className="text-slate-200">–</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Account Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={user.is_active ? 'Active' : 'Inactive'} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Role</span>
                <span className="text-sm font-medium text-primary-700">{roleName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Superuser</span>
                <span className="text-sm font-medium">{user.is_superuser ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Staff</span>
                <span className="text-sm font-medium">{user.is_staff ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Modules</span>
                <span className="text-sm font-bold text-blue-600">{viewPerms}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>
            <div className="space-y-2">
              <button onClick={() => navigate('/admin/users')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">← Back to Users</button>
              {roleId && (
                <button onClick={() => navigate(`/admin/roles/${roleId}`)} className="w-full px-4 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">View Role Details</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
