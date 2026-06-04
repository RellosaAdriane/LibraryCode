export const LIBRARY_DATA_CHANGED_EVENT = 'library-data-changed';
const LIBRARY_SYNC_CHANNEL = 'library-data-sync';

export function dispatchLibraryDataChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT, { detail }));

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(LIBRARY_SYNC_CHANNEL);
      channel.postMessage(detail);
      channel.close();
    }
  } catch {
    // Ignore broadcast failures in unsupported environments.
  }
}

export function subscribeLibraryDataChanged(handler) {
  const onCustomEvent = (event) => {
    handler(event.detail || {});
  };

  window.addEventListener(LIBRARY_DATA_CHANGED_EVENT, onCustomEvent);

  let channel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(LIBRARY_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        handler(event.data || {});
      };
    }
  } catch {
    // Ignore broadcast setup failures.
  }

  return () => {
    window.removeEventListener(LIBRARY_DATA_CHANGED_EVENT, onCustomEvent);
    if (channel) {
      channel.close();
    }
  };
}
