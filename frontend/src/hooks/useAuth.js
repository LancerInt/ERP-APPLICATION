/**
 * Custom hook for authentication state and permission checks
 */

import { useSelector } from 'react-redux';

export const useAuth = () => {
  const auth = useSelector(state => state.auth);

  const isAuthenticated = () => {
    return !!auth.token && !!auth.user;
  };

  const hasRole = (role) => {
    if (typeof role === 'string') {
      return auth.roles?.includes(role) || false;
    }

    if (Array.isArray(role)) {
      return role.some(r => auth.roles?.includes(r));
    }

    return false;
  };

  const hasPermission = (permission) => {
    if (typeof permission === 'string') {
      return auth.permissions?.includes(permission) || false;
    }

    if (Array.isArray(permission)) {
      return permission.some(p => auth.permissions?.includes(p));
    }

    return false;
  };

  const hasModule = (module) => {
    if (typeof module === 'string') {
      return auth.modules?.includes(module) || false;
    }

    if (Array.isArray(module)) {
      return module.some(m => auth.modules?.includes(m));
    }

    return false;
  };

  const canCreate = (module) => {
    return hasPermission(`${module}.create`) || hasRole('admin');
  };

  const canRead = (module) => {
    return hasPermission(`${module}.read`) || hasRole('admin');
  };

  const canUpdate = (module) => {
    return hasPermission(`${module}.update`) || hasRole('admin');
  };

  const canDelete = (module) => {
    return hasPermission(`${module}.delete`) || hasRole('admin');
  };

  const canApprove = (module) => {
    return hasPermission(`${module}.approve`) || hasRole('admin');
  };

  const isAdmin = () => {
    return hasRole('admin');
  };

  return {
    user: auth.user,
    token: auth.token,
    roles: auth.roles || [],
    permissions: auth.permissions || [],
    modules: auth.modules || [],
    warehouseScope: auth.warehouseScope,
    isAuthenticated: isAuthenticated(),
    isAdmin: isAdmin(),
    hasRole,
    hasPermission,
    hasModule,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canApprove,
  };
};

export default useAuth;
