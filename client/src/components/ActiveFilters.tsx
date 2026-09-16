export interface ActiveFilter {
  /** e.g. "Status: voided" — shown on the chip. */
  label: string;
  onRemove: () => void;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onClearAll: () => void;
}

/** Row of removable chips summarising every filter currently narrowing a
 * list, so the selection is visible without opening each dropdown. Renders
 * nothing when no filter is set. */
export function ActiveFilters({ filters, onClearAll }: ActiveFiltersProps) {
  if (filters.length === 0) return null;
  return (
    <div className="active-filters" role="list" aria-label="Active filters">
      <span className="active-filters-label">Filters applied</span>
      {filters.map((f) => (
        <span className="filter-chip" role="listitem" key={f.label}>
          {f.label}
          <button type="button" aria-label={`Remove filter ${f.label}`} onClick={f.onRemove}>×</button>
        </span>
      ))}
      {filters.length > 1 && (
        <button type="button" className="link-btn" onClick={onClearAll}>Clear all</button>
      )}
    </div>
  );
}
