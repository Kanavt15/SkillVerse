/**
 * `useHydrated()`: false during server rendering and the first (hydrating)
 * client render, true afterwards.
 *
 * Use it for values only the browser knows (local timezone, locale), so the
 * server HTML and the first client render match, and there's no hydration error.
 * Built on useSyncExternalStore, React's recommended way to do this (instead of
 * setting state inside an effect).
 */
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
