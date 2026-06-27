import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { EMPTY_PAGINATION, normalizePagination } from "@food/utils/pagination";

/**
 * Reusable infinite-scroll pagination driven entirely by backend `pagination` metadata.
 */
export function useInfinitePagination({
  queryKey,
  fetchPage,
  getItemId = (item, index) =>
    item?.id ?? item?._id ?? item?.mongoId ?? index,
  mergeItems,
  enabled = true,
  initialLimit = 20,
}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(() => ({
    ...EMPTY_PAGINATION,
    limit: initialLimit,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const loadedPagesRef = useRef(new Set());
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);
  const loadMoreRef = useRef(null);
  const paginationRef = useRef(pagination);
  const fetchPageRef = useRef(fetchPage);
  const mergeItemsRef = useRef(mergeItems);
  const getItemIdRef = useRef(getItemId);
  const enabledRef = useRef(enabled);

  paginationRef.current = pagination;
  fetchPageRef.current = fetchPage;
  mergeItemsRef.current = mergeItems;
  getItemIdRef.current = getItemId;
  enabledRef.current = enabled;

  const queryKeyStr = useMemo(() => {
    if (typeof queryKey === "string") return queryKey;
    try {
      return JSON.stringify(queryKey);
    } catch {
      return String(queryKey);
    }
  }, [queryKey]);

  const loadPage = useCallback(async (page, { append = false } = {}) => {
    if (!enabledRef.current) return;
    if (inFlightRef.current) return;
    if (loadedPagesRef.current.has(page)) return;

    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await fetchPageRef.current(page);
      if (seq !== requestSeqRef.current) return;

      const pageItems = Array.isArray(result?.items) ? result.items : [];
      const pagePagination = normalizePagination(result?.pagination);

      loadedPagesRef.current.add(page);
      setPagination(pagePagination);

      setItems((prev) => {
        const base = append ? prev : [];
        const merge = mergeItemsRef.current;
        if (typeof merge === "function") {
          return merge(base, pageItems);
        }

        const seen = new Set(
          base.map((item, index) => String(getItemIdRef.current(item, index))),
        );
        const uniqueIncoming = pageItems.filter((item, index) => {
          const id = String(getItemIdRef.current(item, index));
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        return append ? [...base, ...uniqueIncoming] : uniqueIncoming;
      });

      setError(null);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err);
    } finally {
      if (seq === requestSeqRef.current) {
        inFlightRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    loadedPagesRef.current = new Set();
    setItems([]);
    setPagination({ ...EMPTY_PAGINATION, limit: initialLimit });
    setError(null);
    return loadPage(1, { append: false });
  }, [initialLimit, loadPage]);

  const loadMore = useCallback(() => {
    const { hasNextPage, page } = paginationRef.current;
    if (!hasNextPage || inFlightRef.current) return;
    const nextPage = page + 1;
    if (loadedPagesRef.current.has(nextPage)) return;
    return loadPage(nextPage, { append: true });
  }, [loadPage]);

  const updateItems = useCallback((updater) => {
    setItems((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      requestSeqRef.current += 1;
      inFlightRef.current = false;
      loadedPagesRef.current = new Set();
      setItems([]);
      setPagination({ ...EMPTY_PAGINATION, limit: initialLimit });
      setError(null);
      return;
    }

    requestSeqRef.current += 1;
    inFlightRef.current = false;
    loadedPagesRef.current = new Set();
    setItems([]);
    setPagination({ ...EMPTY_PAGINATION, limit: initialLimit });
    setError(null);
    loadPage(1, { append: false });
  }, [queryKeyStr, enabled, initialLimit, loadPage]);

  useEffect(() => {
    if (!enabled || !pagination.hasNextPage) return;
    if (isLoading || isLoadingMore) return;

    const target = loadMoreRef.current;
    if (!target || typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        loadMore();
      },
      {
        root: null,
        rootMargin: "240px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, pagination.hasNextPage, isLoading, isLoadingMore, loadMore]);

  return {
    items,
    pagination,
    hasNextPage: pagination.hasNextPage,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    loadMoreRef,
    refresh,
    updateItems,
  };
}
