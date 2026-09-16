const mongoose = require('mongoose');

module.exports = mongoose.model('Order', new mongoose.Schema({
  items: [{
    name: String,
    price: Number,
    qty: Number,
    note: String,
    comboItems: [String],
  }],
  orderNumber: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  discount: { type: { type: String, enum: ['percent', 'flat'] }, value: Number, reason: String },
  total: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'card'], required: true },
  amountTendered: Number,   // cash only — what the customer handed over, for change-due / till reconciliation
  orderType: { type: String, enum: ['dine-in', 'takeout', 'delivery'], default: 'takeout' },
  urgent: { type: Boolean, default: false },
  note: String,
  status: { type: String, enum: ['pending', 'preparing', 'ready', 'completed', 'voided'], default: 'pending' },
  voidReason: String,   // required by the API when status becomes 'voided'
  statusHistory: [{
    status: { type: String, enum: ['pending', 'preparing', 'ready', 'completed', 'voided'] },
    at: { type: Date, default: Date.now },
    reason: String,     // set on the 'voided' entry only
  }],
  createdAt: { type: Date, default: Date.now },
}));
