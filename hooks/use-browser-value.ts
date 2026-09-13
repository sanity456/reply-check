'use client';
import { useCallback, useSyncExternalStore } from 'react';
const eventName = 'replycheck:local-metadata-changed';
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(eventName, notify);
  };
}
export function useBrowserValue(key: string) {
  const get = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  return useSyncExternalStore(subscribe, get, () => null);
}
export function saveBrowserValue(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  window.dispatchEvent(new Event(eventName));
}
