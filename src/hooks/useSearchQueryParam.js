import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const useSearchQueryParam = (keys, onMatch) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  const keysSignature = Array.isArray(keys) ? keys.join('\0') : String(keys || '');
  const searchString = searchParams.toString();

  useEffect(() => {
    const keyList = keysSignature ? keysSignature.split('\0').filter(Boolean) : [];
    if (keyList.length === 0) return;

    const current = new URLSearchParams(searchString);
    const hasAny = keyList.some((k) => current.has(k));
    if (!hasAny) return;

    const values = {};
    const next = new URLSearchParams(searchString);
    for (const k of keyList) {
      values[k] = current.get(k);
      next.delete(k);
    }

    onMatchRef.current?.(values);
    setSearchParams(next, { replace: true });
  }, [keysSignature, searchString, setSearchParams]);
};

export default useSearchQueryParam;
