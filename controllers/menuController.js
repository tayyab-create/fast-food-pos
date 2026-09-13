const MenuItem = require('../models/MenuItem');

async function list(req, res) {
  res.json(await MenuItem.find().sort({ category: 1, name: 1 }));
}

async function create(req, res) {
  const { name, price, category, variants, isCombo, comboItems } = req.body;
  const item = await MenuItem.create({ name, price, category, variants, isCombo, comboItems });
  res.status(201).json(item);
}

const UPDATABLE_FIELDS = ['name', 'price', 'category', 'variants', 'isCombo', 'comboItems'];

async function update(req, res) {
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const item = await MenuItem.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' });
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  res.json(item);
}

async function remove(req, res) {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  res.status(204).end();
}

module.exports = { list, create, update, remove };
