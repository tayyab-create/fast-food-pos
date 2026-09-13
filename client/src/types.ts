export interface Variant {
  name: string;
  price: number;
}

export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  variants?: Variant[];
  isCombo?: boolean;
  comboItems?: string[];
}

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
  note?: string;
  comboItems?: string[];
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed';

export interface Discount {
  type: 'percent' | 'flat';
  value: number;
}

export interface Order {
  _id: string;
  orderNumber?: number;
  items: OrderItem[];
  subtotal: number;
  discount?: Discount;
  total: number;
  urgent?: boolean;
  note?: string;
  status: OrderStatus;
  createdAt: string;
}

export interface DailyReport {
  orderCount: number;
  revenue: number;
  topItems: { name: string; qty: number }[];
}
