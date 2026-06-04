import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { formatLibraryClockDisplay, LIBRARY_TIMEZONE } from '../utils/libraryTime';

const RESYNC_MS = 5 * 60 * 1000;

export const useLibraryClock = () => {
  const offsetRef = useRef(0);
  const [full, setFull] = useState('Syncing…');
  const [compact, setCompact] = useState('…');
  const [source, setSource] = useState('syncing');
  const [sourceHost, setSourceHost] = useState('time.google.com');
  const [syncNotice, setSyncNotice] = useState('Syncing library time…');

  const tick = useCallback(() => {
    const instantMs = Date.now() + offsetRef.current;
    setFull(formatLibraryClockDisplay(instantMs, false));
    setCompact(formatLibraryClockDisplay(instantMs, true));
  }, []);

  const sync = useCallback(async () => {
    const result = await api.getPhilippineTime();
    if (!result?.success || !Number.isFinite(Number(result.timestamp_ms))) {
      return;
    }

    offsetRef.current = Number(result.timestamp_ms) - Date.now();
    setSource(result.source || 'server');
    setSourceHost(result.source_host || 'time.google.com');
    tick();
    setSyncNotice(`Library time synced to Philippines (${formatLibraryClockDisplay(Number(result.timestamp_ms), true)})`);
  }, [tick]);

  useEffect(() => {
    sync();
    const tickId = window.setInterval(tick, 1000);
    const syncId = window.setInterval(sync, RESYNC_MS);
    return () => {
      window.clearInterval(tickId);
      window.clearInterval(syncId);
    };
  }, [sync, tick]);

  const title = source === 'google_ntp'
    ? `${full} — Asia/Manila (PHT) via ${sourceHost}`
    : `${full} — Asia/Manila (PHT)`;

  return {
    full,
    compact,
    source,
    sourceHost,
    timezone: LIBRARY_TIMEZONE,
    title,
    syncNotice
  };
};
