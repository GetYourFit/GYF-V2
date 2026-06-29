import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a stable function identity that always invokes the latest `callback`.
 *
 * Lets effects depend on a handler without re-running when the caller passes a
 * fresh inline closure each render (e.g. the Dialog keydown listener depends on
 * `onClose` but must not re-bind on every parent render). `useInsertionEffect`
 * updates the ref before any layout/passive effect reads it in the same commit.
 */
export function useCallbackRef<Args extends unknown[], Return>(
  callback: ((...args: Args) => Return) | undefined,
): (...args: Args) => Return | undefined {
  const ref = useRef(callback);

  useInsertionEffect(() => {
    ref.current = callback;
  });

  return useCallback((...args: Args) => ref.current?.(...args), []);
}
