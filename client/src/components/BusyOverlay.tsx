/**
 * Covers its positioned ancestor with a translucent veil and a spinner while
 * `active`, blocking every click/keystroke underneath (including on a
 * different row than the one that started the action) until it resolves.
 * The caller is responsible for `position: relative` on that ancestor.
 */
export function BusyOverlay({ active, label }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <div className="busy-overlay" role="status" aria-live="polite">
      <span className="spinner large" aria-hidden="true" />
      {label && <span className="busy-overlay-label">{label}</span>}
    </div>
  );
}
