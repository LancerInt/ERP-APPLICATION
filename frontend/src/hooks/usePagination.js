/**
 * Custom hook for pagination state management
 */

import { useState, useCallback } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../utils/constants.js';

export const usePagination = (initialPageSize = DEFAULT_PAGE_SIZE) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }, [totalPages]);

  const handlePageSizeChange = useCallback((newPageSize) => {
    if (!PAGE_SIZE_OPTIONS.includes(newPageSize)) return;
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  const goToFirstPage = useCallback(() => {
    setPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    setPage(totalPages);
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  }, [page, totalPages]);

  const goToPreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const offset = (page - 1) * pageSize;

  const getPaginationParams = () => {
    return {
      page,
      pageSize,
      limit: pageSize,
      offset,
    };
  };

  const reset = useCallback(() => {
    setPage(1);
    setPageSize(initialPageSize);
    setTotal(0);
  }, [initialPageSize]);

  return {
    // State
    page,
    pageSize,
    total,
    isLoading,
    totalPages,
    offset,

    // Boolean flags
    hasNextPage,
    hasPreviousPage,

    // Setters
    setPage,
    setPageSize: handlePageSizeChange,
    setTotal,
    setIsLoading,

    // Navigation
    handlePageChange,
    handlePageSizeChange,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,

    // Utilities
    getPaginationParams,
    reset,
  };
};

export default usePagination;
