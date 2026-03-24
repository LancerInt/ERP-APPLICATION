/**
 * Custom hook for warehouse scope filtering
 */

import { useSelector } from 'react-redux';

export const useWarehouseScope = () => {
  const warehouseScope = useSelector(state => state.auth.warehouseScope);

  const isWarehouseScoped = () => {
    return !!warehouseScope && warehouseScope.length > 0;
  };

  const inWarehouseScope = (warehouseId) => {
    if (!isWarehouseScoped()) return true; // Admin has access to all
    return warehouseScope.includes(warehouseId);
  };

  const filterByWarehouseScope = (items) => {
    if (!isWarehouseScoped()) return items;

    if (!items) return [];

    if (Array.isArray(items)) {
      return items.filter(item => inWarehouseScope(item.warehouse_id || item.warehouse));
    }

    return items;
  };

  const getWhereClause = () => {
    if (!isWarehouseScoped()) return '';
    return `warehouse_id__in=${warehouseScope.join(',')}`;
  };

  const getQueryParams = () => {
    if (!isWarehouseScoped()) return {};
    return { warehouse_id__in: warehouseScope };
  };

  const getScopedUrl = (baseUrl) => {
    if (!isWarehouseScoped()) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${getWhereClause()}`;
  };

  return {
    warehouseScope,
    isWarehouseScoped: isWarehouseScoped(),
    inWarehouseScope,
    filterByWarehouseScope,
    getWhereClause,
    getQueryParams,
    getScopedUrl,
  };
};

export default useWarehouseScope;
