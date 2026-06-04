import {
  LIBRARY_DATA_CHANGED_EVENT,
  dispatchLibraryDataChanged,
  subscribeLibraryDataChanged
} from './libraryDataEvents';

describe('libraryDataEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('dispatchLibraryDataChanged emits a custom event with detail', () => {
    const handler = vi.fn();
    window.addEventListener(LIBRARY_DATA_CHANGED_EVENT, handler);

    dispatchLibraryDataChanged({ source: 'borrow' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ source: 'borrow' });

    window.removeEventListener(LIBRARY_DATA_CHANGED_EVENT, handler);
  });

  test('subscribeLibraryDataChanged receives dispatched events', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeLibraryDataChanged(handler);

    dispatchLibraryDataChanged({ source: 'return' });

    expect(handler).toHaveBeenCalledWith({ source: 'return' });

    unsubscribe();
    dispatchLibraryDataChanged({ source: 'ignored' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('subscribeLibraryDataChanged forwards BroadcastChannel messages when available', () => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    const listeners = new Set();
    const OriginalBroadcastChannel = BroadcastChannel;

    class MockBroadcastChannel {
      constructor(name) {
        this.name = name;
        listeners.add(this);
      }

      postMessage(data) {
        listeners.forEach((listener) => {
          if (listener !== this && typeof listener.onmessage === 'function') {
            listener.onmessage({ data });
          }
        });
      }

      close() {
        listeners.delete(this);
      }
    }

    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    try {
      const handler = vi.fn();
      const unsubscribe = subscribeLibraryDataChanged(handler);
      const channel = new BroadcastChannel('library-data-sync');

      channel.postMessage({ source: 'broadcast' });
      channel.close();

      expect(handler).toHaveBeenCalledWith({ source: 'broadcast' });
      unsubscribe();
    } finally {
      vi.stubGlobal('BroadcastChannel', OriginalBroadcastChannel);
    }
  });
});
