import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../utils/api.js';

let permCache = null;
let permCacheToken = null; // Track which token the cache belongs to

export default function usePermissions() {
  // Watch the Redux auth token — when it changes (login/logout), refetch permissions
  const authToken = useSelector(state => state.auth.token);

  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    // If no token, reset everything
    if (!authToken) {
      permCache = null;
      permCacheToken = null;
      setPermissions([]);
      setIsAdmin(false);
      setIsSuperuser(false);
      setRole(null);
      setIsLoading(false);
      return;
    }

    // If cache is valid for THIS token, use it
    if (permCache && permCacheToken === authToken) {
      setPermissions(permCache.perms || []);
      setIsAdmin(permCache.isAdmin || false);
      setIsSuperuser(permCache.isSuperuser || false);
      setRole(permCache.role || null);
      setIsLoading(false);
      return;
    }

    // Token changed or no cache — fetch fresh
    setIsLoading(true);
    apiClient.get('/api/rbac/my-permissions/')
      .then(res => {
        if (!mounted.current) return;
        const data = res.data || {};
        const perms = data.permissions || [];
        const admin = data.is_admin || false;
        const superuser = data.is_superuser || false;
        const userRole = data.role || null;

        // Cache with token association
        permCache = { perms, isAdmin: admin || superuser, isSuperuser: superuser, role: userRole };
        permCacheToken = authToken;

        setPermissions(perms);
        setIsAdmin(admin || superuser);
        setIsSuperuser(superuser);
        setRole(userRole);
      })
      .catch(() => {
        if (!mounted.current) return;
        permCache = null;
        permCacheToken = null;
        setPermissions([]);
        setIsAdmin(false);
        setIsSuperuser(false);
        setRole(null);
      })
      .finally(() => {
        if (mounted.current) setIsLoading(false);
      });
  }, [authToken]); // Re-run when token changes (login/logout/switch user)

  const canView = (moduleName) => {
    if (isAdmin || isSuperuser) return true;
    if (isLoading) return false;
    return permissions.some(p => (p.module_name === moduleName || p.module?.name === moduleName) && p.can_view);
  };
  const canCreate = (moduleName) => {
    if (isAdmin || isSuperuser) return true;
    if (isLoading) return false;
    return permissions.some(p => (p.module_name === moduleName || p.module?.name === moduleName) && p.can_create);
  };
  const canEdit = (moduleName) => {
    if (isAdmin || isSuperuser) return true;
    if (isLoading) return false;
    return permissions.some(p => (p.module_name === moduleName || p.module?.name === moduleName) && p.can_edit);
  };
  const canDelete = (moduleName) => {
    if (isAdmin || isSuperuser) return true;
    if (isLoading) return false;
    return permissions.some(p => (p.module_name === moduleName || p.module?.name === moduleName) && p.can_delete);
  };

  return { permissions, isLoading, isAdmin, isSuperuser, role, canView, canCreate, canEdit, canDelete };
}

/**
 * Clear the permissions cache (e.g., after role/permission change).
 */
export function clearPermissionsCache() {
  permCache = null;
  permCacheToken = null;
}
