const mongoose = require('mongoose');

module.exports = mongoose.model('MenuItem', new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, default: 'Other' },
  variants: [{ name: String, price: Number }],
  isCombo: { type: Boolean, default: false },
  // Entries reference catalog items by id, not by name, so renaming an item
  // can't orphan the combos that include it. `variant` is the size name when
  // the referenced item has variants; display names are resolved at read time.
  comboItems: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    variant: String,
    qty: { type: Number, default: 1 },
  }],
  image: String,
  available: { type: Boolean, default: true },
}));
