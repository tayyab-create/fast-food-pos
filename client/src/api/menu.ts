import { api } from './client';
import type { MenuItem } from '../types';

export const getMenu = () => api.get<MenuItem[]>('/menu');

export const createMenuItem = (item: Omit<MenuItem, '_id'>) =>
  api.post<MenuItem>('/menu', item);

export const updateMenuItem = (id: string, item: Partial<Omit<MenuItem, '_id'>>) =>
  api.put<MenuItem>(`/menu/${id}`, item);

export const deleteMenuItem = (id: string) => api.del<void>(`/menu/${id}`);

export async function uploadMenuItemImage(id: string, file: File): Promise<MenuItem> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`/api/menu/${id}/image`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteMenuItemImage(id: string): Promise<MenuItem> {
  const res = await fetch(`/api/menu/${id}/image`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Delete failed: ${res.status}`);
  }
  return res.json();
}

/** Server downloads the image at `url`, normalises it like an upload, and stores it. */
export const setMenuItemImageUrl = (id: string, url: string) =>
  api.post<MenuItem>(`/menu/${id}/image-url`, { url });
