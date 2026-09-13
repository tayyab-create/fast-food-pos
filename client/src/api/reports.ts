import { api } from './client';
import type { DailyReport } from '../types';

export const getDailyReport = () => api.get<DailyReport>('/reports/daily');
