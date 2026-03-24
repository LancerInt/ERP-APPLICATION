import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import usePermissions from '../../hooks/usePermissions.js';
import PermissionDenied from './PermissionDenied';

/**
 * ProtectedRoute - Wraps pages with authentication + permission checks.
 *
 * @param {string} module - RBAC module name (e.g., "Company", "Purchase Request")
 * @param {string} action - Permission action: "view", "create", "edit", "delete" (default: "view")
 * @param {boolean} adminOnly - If true, only admin/superuser can access
 * @param {ReactNode} children - The page component to render
 */
export default function ProtectedRoute({ module, action = 'view', adminOnly = false, children }) {
  const isAuthenticated = useSelector(state => !!state.auth.token);
  const { isAdmin, isLoading, canView, canCreate, canEdit, canDelete } = usePermissions();

  // Not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Still loading permissions → show nothing (prevents flash)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Admin-only pages
  if (adminOnly && !isAdmin) {
    return <PermissionDenied />;
  }

  // No module specified → allow (dashboard, etc.)
  if (!module) {
    return children;
  }

  // Check specific permission
  const permCheck = { view: canView, create: canCreate, edit: canEdit, delete: canDelete };
  const checker = permCheck[action] || canView;

  if (!checker(module)) {
    return <PermissionDenied />;
  }

  return children;
}
