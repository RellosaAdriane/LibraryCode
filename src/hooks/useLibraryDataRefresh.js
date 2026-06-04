import { useEffect, useRef } from 'react';
import { subscribeLibraryDataChanged } from '../utils/libraryDataEvents';

export function useLibraryDataRefresh(onRefresh) {
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => subscribeLibraryDataChanged(() => {
    onRefreshRef.current?.();
  }), []);
}
