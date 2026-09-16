import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Dropdown } from './Dropdown';

export interface LedgerColumn<T> {
  header: string;
  numeric?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
  /** Value to sort by when the header is clicked. Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
}

interface LedgerTableProps<T> {
  columns: LedgerColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  emptyMessage?: string;
  /** Enables pagination at this many rows per page. Omit to show all rows. */
  pageSize?: number;
  /** Lets the user pick the page size from this list (plus a "Custom" option). Requires pageSize. */
  pageSizeOptions?: number[];
}

function isActivationKey(e: KeyboardEvent) {
  return e.key === 'Enter' || e.key === ' ';
}

export function LedgerTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isRowSelected,
  emptyMessage,
  pageSize: initialPageSize,
  pageSizeOptions,
}: LedgerTableProps<T>) {
  const [sort, setSort] = useState<{ header: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [customPageSize, setCustomPageSize] = useState(false);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.header === sort.header);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -sort.dir;
      if (av > bv) return sort.dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = pageSize ? sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize) : sortedRows;

  function toggleSort(col: LedgerColumn<T>) {
    if (!col.sortValue) return;
    setPage(0);
    setSort((prev) =>
      prev?.header === col.header ? { header: col.header, dir: prev.dir === 1 ? -1 : 1 } : { header: col.header, dir: 1 }
    );
  }

  return (
    <>
    <table className="ledger">
      <thead>
        <tr>
          {columns.map((col) => {
            const sortable = !!col.sortValue;
            const active = sort?.header === col.header;
            return (
              <th
                key={col.header}
                className={[col.numeric ? 'num' : '', sortable ? 'sortable' : ''].filter(Boolean).join(' ') || undefined}
                style={col.width ? { width: col.width } : undefined}
                tabIndex={sortable ? 0 : undefined}
                aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                onClick={() => toggleSort(col)}
                onKeyDown={(e) => {
                  if (sortable && isActivationKey(e)) {
                    e.preventDefault();
                    toggleSort(col);
                  }
                }}
              >
                {col.header}
                {active && <span className="sort-arrow">{sort.dir === 1 ? ' ▲' : ' ▼'}</span>}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {pageRows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>{emptyMessage ?? 'Nothing here yet.'}</td>
          </tr>
        ) : (
          pageRows.map((row) => (
            <tr
              key={rowKey(row)}
              className={[isRowSelected?.(row) ? 'selected' : '', onRowClick ? 'clickable' : ''].filter(Boolean).join(' ') || undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => {
                if (onRowClick && isActivationKey(e) && e.target === e.currentTarget) {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              {columns.map((col) => (
                <td key={col.header} className={col.numeric ? 'num' : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
    {pageSize && (sortedRows.length > pageSize || !!pageSizeOptions) && (
      <div className="ledger-pagination">
        {pageSizeOptions && (
          <div className="ledger-pagination-size">
            <span>Rows:</span>
            {customPageSize ? (
              <input
                type="number"
                min={1}
                className="ledger-pagination-custom"
                value={pageSize}
                autoFocus
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0) {
                    setPageSize(n);
                    setPage(0);
                  }
                }}
                onBlur={() => setCustomPageSize(false)}
              />
            ) : (
              <Dropdown
                value={pageSizeOptions.includes(pageSize) ? String(pageSize) : 'custom'}
                options={[
                  ...pageSizeOptions.map((n) => ({ value: String(n), label: String(n) })),
                  { value: 'custom', label: 'Custom…' },
                ]}
                onChange={(v) => {
                  if (v === 'custom') {
                    setCustomPageSize(true);
                  } else {
                    setPageSize(Number(v));
                    setPage(0);
                  }
                }}
              />
            )}
          </div>
        )}
        <span className="ledger-pagination-page">
          Page {currentPage + 1} of {pageCount}
        </span>
        <div className="ledger-pagination-controls">
          <button
            type="button"
            className="ghost"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="ghost"
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            ›
          </button>
        </div>
      </div>
    )}
    </>
  );
}
