import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic data-fetching hook.
 *
 * @param {Function} fetcher  - async function that returns data
 * @param {Array}    deps     - re-fetch when any dep changes (like useEffect)
 *
 * @returns {{ data, loading, error, refetch }}
 *
 * Usage:
 *   const { data, loading, error } = useApi(() => getReports({ page }), [page]);
 */
export function useApi(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    setLoading(true);
    setError('');
    fetcherRef.current()
      .then(result => setData(result))
      .catch(err   => setError(err.message ?? 'An error occurred.'))
      .finally(()  => setLoading(false));
  }, []);

  useEffect(() => {
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
}
