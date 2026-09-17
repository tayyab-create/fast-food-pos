import { useEffect, useState } from 'react';
import { getSettings } from '../api/settings';

const FALLBACK = [10, 25, 50];

/**
 * The admin-configurable "Rows:" picker choices (Settings page), shared by
 * every paginated LedgerTable. Starts at the app's built-in fallback and
 * swaps in the stored list once it loads — a table never blocks its own
 * render waiting on this, and a load failure just keeps the fallback.
 */
export function usePageSizeOptions(): number[] {
  const [options, setOptions] = useState<number[]>(FALLBACK);
  useEffect(() => {
    getSettings().then((s) => setOptions(s.pageSizeOptions)).catch(() => {});
  }, []);
  return options;
}
