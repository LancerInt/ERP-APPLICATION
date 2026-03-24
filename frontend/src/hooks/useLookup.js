import { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/api.js';

/**
 * Cache for lookup data to avoid redundant API calls across components.
 */
const cache = {};

/**
 * Hook to fetch lookup/dropdown data from API endpoints.
 * Caches results so multiple forms on the same page don't re-fetch.
 *
 * @param {string} endpoint - API endpoint (e.g., '/api/companies/')
 * @param {object} options - { labelField, valueField, autoFetch }
 * @returns {{ options: [{value, label}], isLoading, raw }}
 */
export default function useLookup(endpoint, options = {}) {
  const {
    labelField = 'name',
    valueField = 'id',
    autoFetch = true,
  } = options;

  const [items, setItems] = useState(cache[endpoint] || []);
  const [isLoading, setIsLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!autoFetch || !endpoint) return;

    // Use cache if available and non-empty
    if (cache[endpoint] && cache[endpoint].length > 0) {
      setItems(cache[endpoint]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get(endpoint, { params: { page_size: 500 } });
        const results = response.data?.results || response.data || [];
        if (import.meta.env.DEV) {
          console.log(`[useLookup] ${endpoint}: fetched ${results.length} items`);
        }
        cache[endpoint] = results;
        if (mounted.current) setItems(results);
      } catch (err) {
        console.error(`[useLookup] Failed to fetch ${endpoint}:`, err?.response?.status, err?.response?.data || err.message);
        // Don't cache failures — allow retry on next render
        if (mounted.current) setItems([]);
      } finally {
        if (mounted.current) setIsLoading(false);
      }
    };

    fetchData();
  }, [endpoint, autoFetch]);

  // Build options array for <select> elements
  const selectOptions = items.map(item => ({
    value: item[valueField],
    label: typeof labelField === 'function'
      ? labelField(item)
      : (item[labelField]
        || item.name
        || item.product_name
        || item.godown_name
        || item.legal_name
        || item.vendor_name
        || item.vendor_code
        || item.customer_name
        || item.customer_code
        || item.transporter_code
        || item.staff_id
        || item.first_name
        || item.sku_code
        || item.template_id
        || item.shift_code
        || item.role_name
        || item.pr_no
        || item.rfq_no
        || item.po_no
        || item.so_no
        || item.warehouse_code
        || item.godown_code
        || item[valueField]
      ),
  }));

  return { options: selectOptions, isLoading, raw: items };
}

/**
 * Clear the lookup cache (e.g., after creating a new record).
 */
export function clearLookupCache(endpoint) {
  if (endpoint) {
    delete cache[endpoint];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
