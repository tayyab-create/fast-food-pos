const mongoose = require('mongoose');

// Categories and tags live on their own, independent of the items that use
// them: deleting the last item in a category (or the last item wearing a tag)
// leaves the label in place, so it can be reused or tidied from Settings.
// `kind` keeps both in one collection; `name` is unique per kind.
const schema = new mongoose.Schema({
  kind: { type: String, enum: ['category', 'tag'], required: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });
schema.index({ kind: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Label', schema);
