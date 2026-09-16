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
  /** Pinned items sort first on the Cashier grid. */
  pinned?: boolean;
  /** Short labels shown on the Cashier tile, e.g. 'New', 'Spicy'. */
  tags?: string[];
}

export type LabelKind = 'category' | 'tag';

/** A category or tag registered on its own, with how many menu items use it. */
export interface Label {
  _id: string;
  name: string;
  itemCount: number;
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

export interface ReportBucket {
  count: number;
  revenue: number;
}

/** Aggregates for a date range (or all time). */
export interface SummaryReport {
  orderCount: number;
  revenue: number;
  avgOrder: number;
  discountTotal: number;
  voidedCount: number;
  voidedTotal: number;
  topItems: { name: string; qty: number }[];
  byPaymentMethod: Partial<Record<PaymentMethod, ReportBucket>>;
  byOrderType: Partial<Record<OrderType, ReportBucket>>;
  /** Index = hour of day, 0–23. */
  byHour: ReportBucket[];
  /** Index = day of week, 0 = Sunday. */
  byWeekday: ReportBucket[];
  /** One entry per calendar day that had orders, ascending. */
  byDay: ({ date: string } & ReportBucket)[];
  /** Per-item sales; orderShare = fraction of orders containing the item. */
  items: { name: string; qty: number; revenue: number; orders: number; orderShare: number }[];
  cashTendered: number;
  changeGiven: number;
  /** Fraction of order lines that were combos. */
  comboShare: number;
  discountsByReason: { reason: string; count: number; amount: number }[];
  voids: { _id: string; orderNumber: number; total: number; reason: string; at: string }[];
}
