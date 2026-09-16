export interface Variant {
  name: string;
  price: number;
}

/** A combo ingredient — references the catalog item by id (so renames can't
 * orphan it); `variant` is the size name when that item has variants. */
export interface ComboEntry {
  itemId: string;
  variant?: string;
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
  /** Display snapshot of a combo's contents at order time, e.g. "2× Fries (Large)". */
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
  /** Present on the 'voided' entry. */
  reason?: string;
}

export interface Order {
  _id: string;
  orderNumber: number;
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
  voidReason?: string;
  statusHistory?: StatusChange[];
  createdAt: string;
}

export interface DailyReport {
  orderCount: number;
  revenue: number;
  topItems: { name: string; qty: number }[];
}
