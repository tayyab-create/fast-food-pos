import { useMemo, useState, type ReactNode } from 'react';

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
}

export function LedgerTable<T>({ columns, rows, rowKey, onRowClick, isRowSelected, emptyMessage }: LedgerTableProps<T>) {
  const [sort, setSort] = useState<{ header: string; dir: 1 | -1 } | null>(null);

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

  function toggleSort(col: LedgerColumn<T>) {
    if (!col.sortValue) return;
    setSort((prev) =>
      prev?.header === col.header ? { header: col.header, dir: prev.dir === 1 ? -1 : 1 } : { header: col.header, dir: 1 }
    );
  }

  return (
    <table className="ledger">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.header}
              className={[col.numeric ? 'num' : '', col.sortValue ? 'sortable' : ''].filter(Boolean).join(' ') || undefined}
              style={col.width ? { width: col.width } : undefined}
              onClick={() => toggleSort(col)}
            >
              {col.header}
              {sort?.header === col.header && <span className="sort-arrow">{sort.dir === 1 ? ' ▲' : ' ▼'}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>{emptyMessage ?? 'Nothing here yet.'}</td>
          </tr>
        ) : (
          sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={isRowSelected?.(row) ? 'selected' : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
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
  );
}
