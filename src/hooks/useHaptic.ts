import { useCallback } from 'react';

export function useHaptic() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const tap = useCallback(() => vibrate(30), [vibrate]);
  const doubleTap = useCallback(() => vibrate([30, 50, 30]), [vibrate]);
  const success = useCallback(() => vibrate([50, 30, 100]), [vibrate]);
  const warning = useCallback(() => vibrate([100, 50, 100, 50, 100]), [vibrate]);
  const notification = useCallback(() => vibrate([50, 100, 50]), [vibrate]);

  return { vibrate, tap, doubleTap, success, warning, notification };
}
