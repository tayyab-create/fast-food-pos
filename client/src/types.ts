export interface Variant {
  name: string;
  price: number;
}

export interface ComboEntry {
  name: string;
  qty: number;
}

export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  variants?: Variant[];
  isCombo?: boolean;
  comboItems?: ComboEntry[];
  image?: string;
  available?: boolean;
}

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
  note?: string;
  comboItems?: string[];
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'voided';

export interface Discount {
  type: 'percent' | 'flat';
  value: number;
  reason?: string;
}

export type PaymentMethod = 'cash' | 'card';
export type OrderType = 'dine-in' | 'takeout' | 'delivery';

export interface StatusChange {
  status: OrderStatus;
  at: string;
}

export interface Order {
  _id: string;
  orderNumber?: number;
  items: OrderItem[];
  subtotal: number;
  discount?: Discount;
  total: number;
  paymentMethod: PaymentMethod;
  orderType?: OrderType;
  amountTendered?: number;
  urgent?: boolean;
  note?: string;
  status: OrderStatus;
  statusHistory?: StatusChange[];
  createdAt: string;
}

export interface DailyReport {
  orderCount: number;
  revenue: number;
  topItems: { name: string; qty: number }[];
}
