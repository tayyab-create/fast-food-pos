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
  discount: { type: { type: String, enum: ['percent', 'flat'] }, value: Number },
  total: { type: Number, required: true },
  urgent: { type: Boolean, default: false },
  note: String,
  status: { type: String, enum: ['pending', 'preparing', 'ready', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
}));
