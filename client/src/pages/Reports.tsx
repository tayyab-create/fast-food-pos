import { useEffect, useState } from 'react';
import { getDailyReport } from '../api/reports';
import { LedgerTable } from '../components/LedgerTable';
import type { DailyReport } from '../types';

export function Reports() {
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    getDailyReport().then(setReport);
  }, []);

  if (!report) return <p>Loading…</p>;

  return (
    <div>
      <div className="stats-row">
        <div className="stat">
          <div className="value">{report.orderCount}</div>
          <div className="label">Orders Today</div>
        </div>
        <div className="stat">
          <div className="value">${report.revenue.toFixed(2)}</div>
          <div className="label">Revenue Today</div>
        </div>
      </div>

      <LedgerTable
        columns={[
          { header: 'Item', render: (i) => i.name },
          { header: 'Qty Sold', numeric: true, render: (i) => i.qty },
        ]}
        rows={report.topItems}
        rowKey={(i) => i.name}
        emptyMessage="No sales yet today."
      />
    </div>
  );
}
