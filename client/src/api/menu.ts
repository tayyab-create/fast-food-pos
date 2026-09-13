import { api } from './client';
import type { MenuItem } from '../types';

export const getMenu = () => api.get<MenuItem[]>('/menu');

export const createMenuItem = (item: Omit<MenuItem, '_id'>) =>
  api.post<MenuItem>('/menu', item);

export const updateMenuItem = (id: string, item: Partial<Omit<MenuItem, '_id'>>) =>
  api.put<MenuItem>(`/menu/${id}`, item);

export const deleteMenuItem = (id: string) => api.del<void>(`/menu/${id}`);
