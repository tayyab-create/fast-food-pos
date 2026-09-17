const mongoose = require('mongoose');

// One document for the whole app — a config singleton, not a per-item
// collection like Label. Always read/written via _id: 'app' so there's
// never a question of "which settings row."
const schema = new mongoose.Schema({
  _id: { type: String, default: 'app' },
  // Choices offered in every paginated table's "Rows:" picker. The table's
  // own default page size (10) is a client constant, not stored here —
  // this only customises what else the picker offers alongside it.
  pageSizeOptions: { type: [Number], default: [10, 25, 50] },
});

module.exports = mongoose.model('Settings', schema);
