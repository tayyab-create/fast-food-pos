import { api } from './client';
import type { Discount, Order, OrderItem, OrderStatus } from '../types';

export const getOrders = (status?: OrderStatus) =>
  api.get<Order[]>(status ? `/orders?status=${status}` : '/orders');

interface CreateOrderOptions {
  discount?: Discount;
  urgent?: boolean;
  note?: string;
}

export const createOrder = (items: OrderItem[], options?: CreateOrderOptions) =>
  api.post<Order>('/orders', { items, ...options });

export const updateOrderStatus = (id: string, status: OrderStatus) =>
  api.patch<Order>(`/orders/${id}`, { status });
