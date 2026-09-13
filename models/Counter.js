const mongoose = require('mongoose');

// Single doc per counter name (e.g. "orderNumber"), incremented atomically
// via findOneAndUpdate's $inc — safe under concurrent requests, unlike a
// max+1 lookup on the Order collection.
module.exports = mongoose.model('Counter', new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
}));
