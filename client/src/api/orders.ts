import { api } from './client';
import type { Discount, Order, OrderItem, OrderStatus, OrderType, PaymentMethod } from '../types';

export const getOrders = (status?: OrderStatus) =>
  api.get<Order[]>(status ? `/orders?status=${status}` : '/orders');

interface CreateOrderOptions {
  discount?: Discount;
  urgent?: boolean;
  note?: string;
  paymentMethod: PaymentMethod;
  orderType?: OrderType;
  amountTendered?: number;
}

export const createOrder = (items: OrderItem[], options?: CreateOrderOptions) =>
  api.post<Order>('/orders', { items, ...options });

/** `reason` is required by the server when `status` is 'voided'. */
export const updateOrderStatus = (id: string, status: OrderStatus, reason?: string) =>
  api.patch<Order>(`/orders/${id}`, { status, reason });
