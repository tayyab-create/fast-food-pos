const dns = require('dns/promises');
const fs = require('fs/promises');
const http = require('http');
const https = require('https');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');
const MenuItem = require('../models/MenuItem');
const { isMoney } = require('../lib/money');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_TAGS = 3;
const MAX_TAG_LENGTH = 16;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

async function list(req, res) {
  res.json(await MenuItem.find().sort({ category: 1, name: 1 }));
}

// Shared validation for create/update — returns an error string, or null if valid.
// Fields are only checked when present, so update() can validate a partial payload.
function validateFields({ name, price, category, variants, comboItems, tags }) {
  if (name !== undefined && !String(name).trim()) return 'Name is required';
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) return 'Tags must be a list of words';
    if (tags.length > MAX_TAGS) return `At most ${MAX_TAGS} tags`;
    if (tags.some((t) => !t.trim() || t.trim().length > MAX_TAG_LENGTH)) return `Each tag must be 1–${MAX_TAG_LENGTH} characters`;
  }
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
  const { name, price, category, variants, isCombo, comboItems, available, pinned, tags } = req.body;
  const error = !name || price === undefined || !category
    ? 'Name, price, and category are required'
    : validateFields({ name, price, category, variants, comboItems, tags }) || await comboItemsError(comboItems);
  if (error) return res.status(400).json({ error });
  const item = await MenuItem.create({
    name: String(name).trim(),
    price,
    category: String(category).trim(),
    variants,
    isCombo,
    comboItems,
    available,
    pinned,
    tags: tags?.map((t) => t.trim()),
  });
  res.status(201).json(item);
}

const UPDATABLE_FIELDS = ['name', 'price', 'category', 'variants', 'isCombo', 'comboItems', 'available', 'pinned', 'tags'];

async function update(req, res) {
  const error = validateFields(req.body) || await comboItemsError(req.body.comboItems);
  if (error) return res.status(400).json({ error });
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.name !== undefined) updates.name = String(updates.name).trim();
  if (updates.category !== undefined) updates.category = String(updates.category).trim();
  if (updates.tags !== undefined) updates.tags = updates.tags.map((t) => t.trim());
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

// Normalises any source image to a 640×640 JPEG on disk and points the item at
// it. Responds itself; returns nothing.
async function storeImage(item, buffer, res) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${item._id}.jpg`;
  try {
    await sharp(buffer)
      .resize(640, 640, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(path.join(UPLOAD_DIR, filename));
  } catch {
    return res.status(400).json({ error: 'The file is not a readable image' });
  }

  item.image = `/uploads/${filename}?v=${Date.now()}`;
  await item.save();
  res.json(item);
}

async function uploadImage(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  await storeImage(item, req.file.buffer, res);
}

// Loopback, link-local and RFC 1918 ranges — a pasted URL must not be able to
// make the server fetch from itself or the LAN.
function isPrivateAddress(address, family) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPrivateAddress(mapped[1], 4);
  if (family === 6) return address === '::1' || /^f[cd]/i.test(address) || address.startsWith('fe80');
  const [a, b] = address.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Downloads an image from a public http(s) URL, capped at MAX_IMAGE_BYTES.
 * Throws with a user-facing message on any problem.
 *
 * The hostname is resolved exactly once and the socket is pinned to that
 * validated address (via the `lookup` option), so a DNS-rebinding host can't
 * pass the check and then resolve to a private address for the real
 * connection. SNI/Host still use the original hostname, so TLS verifies. */
async function fetchImage(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw new Error('Enter a valid image URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Image URL must start with http:// or https://');

  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => { throw new Error('Image host could not be found'); });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address, a.family))) {
    throw new Error('Image URL must point to a public host');
  }
  const pinned = addresses[0];

  const response = await new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, {
      // Some CDNs (Wikimedia among them) reject requests with no User-Agent.
      headers: { 'User-Agent': 'FastFoodPOS/1.0' },
      timeout: FETCH_TIMEOUT_MS,
      // net may ask with { all: true } (happy-eyeballs) or for a single address.
      lookup: (_host, opts, cb) => (opts.all ? cb(null, [pinned]) : cb(null, pinned.address, pinned.family)),
    }, resolve);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => reject(new Error('Image could not be downloaded')));
  });

  const fail = (message) => { response.destroy(); throw new Error(message); };
  if (response.statusCode >= 300 && response.statusCode < 400) fail('Image URL must not redirect — paste the final image address');
  if (response.statusCode !== 200) fail(`Image could not be downloaded (HTTP ${response.statusCode})`);
  if (!response.headers['content-type']?.startsWith('image/')) fail('That URL is not an image');
  if (Number(response.headers['content-length']) > MAX_IMAGE_BYTES) fail('Image must be 5MB or smaller');

  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) fail('Image must be 5MB or smaller');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function uploadImageFromUrl(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  let buffer;
  try {
    buffer = await fetchImage(req.body.url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  await storeImage(item, buffer, res);
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

module.exports = { list, create, update, remove, uploadImage, uploadImageFromUrl, removeImage, validateFields, isPrivateAddress };
