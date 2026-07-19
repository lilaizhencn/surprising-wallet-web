import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

type QueryState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
};

export function useApiQuery<T>(
  query: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<QueryState<T>>({ loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: undefined }));
    void query(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Unable to load data',
          });
        }
      });
    return () => controller.abort();
    // The caller intentionally controls refetch dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);

  const refetch = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, refetch };
}
