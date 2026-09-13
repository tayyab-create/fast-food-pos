import { api } from './client';
import type { Discount, Order, OrderItem, OrderStatus, PaymentMethod } from '../types';

export const getOrders = (status?: OrderStatus) =>
  api.get<Order[]>(status ? `/orders?status=${status}` : '/orders');

interface CreateOrderOptions {
  discount?: Discount;
  urgent?: boolean;
  note?: string;
  paymentMethod: PaymentMethod;
}

export const createOrder = (items: OrderItem[], options?: CreateOrderOptions) =>
  api.post<Order>('/orders', { items, ...options });

export const updateOrderStatus = (id: string, status: OrderStatus) =>
  api.patch<Order>(`/orders/${id}`, { status });
