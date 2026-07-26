import { useCallback, useState } from 'react';

export function useServerPagination(initialPageSize = 20) {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const offset = (current - 1) * pageSize;

  const reset = useCallback(() => setCurrent(1), []);
  const config = useCallback((total: number) => ({
    current,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (value: number) => `${value}`,
    onChange: (nextPage: number, nextPageSize: number) => {
      setCurrent(nextPageSize === pageSize ? nextPage : 1);
      setPageSize(nextPageSize);
    },
  }), [current, pageSize]);

  return { current, pageSize, offset, reset, config };
}
