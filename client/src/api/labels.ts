import { api } from './client';
import type { Label, LabelKind } from '../types';

export const getLabels = (kind: LabelKind) => api.get<Label[]>(`/labels/${kind}`);
export const createLabel = (kind: LabelKind, name: string) => api.post<Label>(`/labels/${kind}`, { name });
/** Renaming carries the new name onto every item that used the old one. */
export const renameLabel = (kind: LabelKind, id: string, name: string) => api.put<Label>(`/labels/${kind}/${id}`, { name });
/** Items in a deleted category move to "Other"; a deleted tag is removed from every item. */
export const deleteLabel = (kind: LabelKind, id: string) => api.del<void>(`/labels/${kind}/${id}`);
