const mongoose = require('mongoose');

module.exports = mongoose.model('MenuItem', new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, default: 'Other' },
  variants: [{ name: String, price: Number }],
  isCombo: { type: Boolean, default: false },
  comboItems: [{ name: String, qty: { type: Number, default: 1 } }],
  image: String,
  available: { type: Boolean, default: true },
}));
