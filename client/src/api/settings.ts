import { api } from './client';
import type { AppSettings } from '../types';

export const getSettings = () => api.get<AppSettings>('/settings');
export const updateSettings = (settings: AppSettings) => api.put<AppSettings>('/settings', settings);
