import { api } from './client';
import type { SummaryReport } from '../types';

/** `from`/`to` are inclusive YYYY-MM-DD (local); omit both for all time. */
export const getSummaryReport = (from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return api.get<SummaryReport>(`/reports/summary${query ? `?${query}` : ''}`);
};

/** Names of the best-selling items over the last week. */
export const getPopularItems = () => api.get<string[]>('/reports/popular');

/** Quantity sold per item name over the last 7 days, keyed by item name. */
export const getRecentSales = () => api.get<Record<string, number>>('/reports/recent-sales');
