import { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/api.js';

/**
 * Hook to fetch paginated list data from the API.
 * Replaces hardcoded mock data with real API calls.
 *
 * @param {string} endpoint - API endpoint (e.g., '/api/companies/')
 * @param {object} options - { autoFetch: true }
 * @returns {{ data, isLoading, error, refetch, totalCount }}
 */
export default function useApiData(endpoint, options = {}) {
  const { autoFetch = true } = options;
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = useCallback(async (params = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(endpoint, { params });
      // DRF paginated response: { count, next, previous, results }
      // Or plain array for non-paginated endpoints
      if (response.data && Array.isArray(response.data.results)) {
        setData(response.data.results);
        setTotalCount(response.data.count || response.data.results.length);
      } else if (Array.isArray(response.data)) {
        setData(response.data);
        setTotalCount(response.data.length);
      } else {
        setData([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error(`[useApiData] Failed to fetch ${endpoint}:`, err);
      setError(err.response?.data || err.message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return { data, isLoading, error, refetch: fetchData, totalCount };
}
