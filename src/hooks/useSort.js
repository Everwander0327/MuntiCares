import { useState, useMemo } from 'react';

const useSort = (data, defaultKey = '', defaultDir = 'asc') => {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const getSortIndicator = (key) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return { sorted, sortKey, sortDir, handleSort, getSortIndicator };
};

export default useSort;
