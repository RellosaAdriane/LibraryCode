import { useEffect, useRef } from 'react';

export const DEFAULT_SYNC_POLL_MS = 5000;

export function useSyncPolling({
  enabled = true,
  fetchRevision,
  onRevisionChange,
  pollMs = DEFAULT_SYNC_POLL_MS
}) {
  const revisionRef = useRef(null);
  const onRevisionChangeRef = useRef(onRevisionChange);
  const fetchRevisionRef = useRef(fetchRevision);

  useEffect(() => {
    onRevisionChangeRef.current = onRevisionChange;
  }, [onRevisionChange]);

  useEffect(() => {
    fetchRevisionRef.current = fetchRevision;
  }, [fetchRevision]);

  useEffect(() => {
    if (!enabled) {
      revisionRef.current = null;
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;

    const scheduleNext = (delay = pollMs) => {
      if (cancelled) return;
      timeoutId = window.setTimeout(checkForUpdates, delay);
    };

    const checkForUpdates = async () => {
      if (cancelled) {
        return;
      }

      if (document.visibilityState === 'hidden') {
        scheduleNext();
        return;
      }

      const fetchRevisionFn = fetchRevisionRef.current;
      if (typeof fetchRevisionFn !== 'function') {
        scheduleNext();
        return;
      }

      const result = await fetchRevisionFn();
      if (cancelled) {
        return;
      }

      if (result?.success && result.revision) {
        if (revisionRef.current !== null && revisionRef.current !== result.revision) {
          onRevisionChangeRef.current?.();
        }
        revisionRef.current = result.revision;
      }

      scheduleNext();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || cancelled) {
        return;
      }

      window.clearTimeout(timeoutId);
      checkForUpdates();
    };

    const handleWindowFocus = () => {
      if (cancelled) {
        return;
      }

      window.clearTimeout(timeoutId);
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    checkForUpdates();

    return () => {
      cancelled = true;
      revisionRef.current = null;
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled, pollMs]);
}
