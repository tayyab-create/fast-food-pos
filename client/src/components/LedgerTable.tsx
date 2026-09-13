import type { ReactNode } from 'react';

export interface LedgerColumn<T> {
  header: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
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
  return (
    <table className="ledger">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.header} className={col.numeric ? 'num' : undefined}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>{emptyMessage ?? 'Nothing here yet.'}</td>
          </tr>
        ) : (
          rows.map((row) => (
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
