const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');
const MenuItem = require('../models/MenuItem');
const { isMoney } = require('../lib/money');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

async function list(req, res) {
  res.json(await MenuItem.find().sort({ category: 1, name: 1 }));
}

// Shared validation for create/update — returns an error string, or null if valid.
// Fields are only checked when present, so update() can validate a partial payload.
function validateFields({ name, price, category, variants, comboItems }) {
  if (name !== undefined && !String(name).trim()) return 'Name is required';
  if (price !== undefined && !(Number(price) > 0)) return 'Price must be a positive number';
  if (price !== undefined && !isMoney(price)) return 'Price can have at most two decimal places';
  if (category !== undefined && !String(category).trim()) return 'Category is required';
  if (variants !== undefined) {
    if (!Array.isArray(variants)) return 'Sizes must be a list';
    for (const v of variants) {
      if (!v?.name || !String(v.name).trim()) return 'Each size needs a name';
      if (!(Number(v.price) > 0)) return `Size "${v.name}" needs a positive price`;
      if (!isMoney(v.price)) return `Size "${v.name}" price can have at most two decimal places`;
    }
  }
  if (comboItems !== undefined) {
    if (!Array.isArray(comboItems)) return 'Combo items must be a list';
    for (const c of comboItems) {
      if (!mongoose.isValidObjectId(c?.itemId)) return 'Each combo item needs a valid itemId';
      if (!Number.isInteger(Number(c.qty)) || Number(c.qty) < 1) return 'Combo item quantity must be a whole number of 1 or more';
      if (c.variant !== undefined && typeof c.variant !== 'string') return 'Combo item variant must be a size name';
    }
  }
  return null;
}

// Every referenced combo item must exist and must not itself be a combo.
async function comboItemsError(comboItems) {
  if (!comboItems?.length) return null;
  const ids = comboItems.map((c) => c.itemId);
  const found = await MenuItem.find({ _id: { $in: ids } }, { isCombo: 1 });
  if (found.length !== new Set(ids.map(String)).size) return 'A combo item references a menu item that no longer exists';
  if (found.some((i) => i.isCombo)) return 'A combo cannot contain another combo';
  return null;
}

async function create(req, res) {
  const { name, price, category, variants, isCombo, comboItems, available } = req.body;
  const error = !name || price === undefined || !category
    ? 'Name, price, and category are required'
    : validateFields({ name, price, category, variants, comboItems }) || await comboItemsError(comboItems);
  if (error) return res.status(400).json({ error });
  const item = await MenuItem.create({
    name: String(name).trim(),
    price,
    category: String(category).trim(),
    variants,
    isCombo,
    comboItems,
    available,
  });
  res.status(201).json(item);
}

const UPDATABLE_FIELDS = ['name', 'price', 'category', 'variants', 'isCombo', 'comboItems', 'available'];

async function update(req, res) {
  const error = validateFields(req.body) || await comboItemsError(req.body.comboItems);
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
  await Promise.all([
    MenuItem.updateMany({ 'comboItems.itemId': item._id }, { $pull: { comboItems: { itemId: item._id } } }),
    fs.unlink(path.join(UPLOAD_DIR, `${item._id}.jpg`)).catch(() => {}),
  ]);
  res.status(204).end();
}

async function uploadImage(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${item._id}.jpg`;
  try {
    await sharp(req.file.buffer)
      .resize(640, 640, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(path.join(UPLOAD_DIR, filename));
  } catch {
    return res.status(400).json({ error: 'The uploaded file is not a readable image' });
  }

  item.image = `/uploads/${filename}?v=${Date.now()}`;
  await item.save();
  res.json(item);
}

async function removeImage(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  if (item.image) {
    await fs.unlink(path.join(UPLOAD_DIR, `${item._id}.jpg`)).catch(() => {});
  }
  item.image = undefined;
  await item.save();
  res.json(item);
}

module.exports = { list, create, update, remove, uploadImage, removeImage, validateFields };
