const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const MenuItem = require('../models/MenuItem');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

async function list(req, res) {
  res.json(await MenuItem.find().sort({ category: 1, name: 1 }));
}

// Shared validation for create/update — returns an error string, or null if valid.
// Fields are only checked when present, so update() can validate a partial payload.
function validateFields({ name, price, category, variants }) {
  if (name !== undefined && !String(name).trim()) return 'Name is required';
  if (price !== undefined && !(Number(price) > 0)) return 'Price must be a positive number';
  if (category !== undefined && !String(category).trim()) return 'Category is required';
  if (variants) {
    for (const v of variants) {
      if (!v.name || !String(v.name).trim()) return 'Each size needs a name';
      if (!(Number(v.price) > 0)) return `Size "${v.name}" needs a positive price`;
    }
  }
  return null;
}

async function create(req, res) {
  const { name, price, category, variants, isCombo, comboItems } = req.body;
  const error = !name || price === undefined || !category
    ? 'Name, price, and category are required'
    : validateFields({ name, price, category, variants });
  if (error) return res.status(400).json({ error });
  const item = await MenuItem.create({ name: String(name).trim(), price, category: String(category).trim(), variants, isCombo, comboItems });
  res.status(201).json(item);
}

const UPDATABLE_FIELDS = ['name', 'price', 'category', 'variants', 'isCombo', 'comboItems'];

async function update(req, res) {
  const error = validateFields(req.body);
  if (error) return res.status(400).json({ error });
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.name !== undefined) updates.name = String(updates.name).trim();
  if (updates.category !== undefined) updates.category = String(updates.category).trim();
  const item = await MenuItem.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' });
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  res.json(item);
}

async function remove(req, res) {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  res.status(204).end();
}

async function uploadImage(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${item._id}.jpg`;
  await sharp(req.file.buffer)
    .resize(640, 640, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(path.join(UPLOAD_DIR, filename));

  item.image = `/uploads/${filename}?v=${Date.now()}`;
  await item.save();
  res.json(item);
}

async function removeImage(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  if (item.image) {
    const filename = `${item._id}.jpg`;
    await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
  }
  item.image = undefined;
  await item.save();
  res.json(item);
}

module.exports = { list, create, update, remove, uploadImage, removeImage };
