const Label = require('../models/Label');
const MenuItem = require('../models/MenuItem');

const KINDS = ['category', 'tag'];
const MAX_LENGTH = { category: 40, tag: 16 };
const FALLBACK_CATEGORY = 'Other';

/** Trimmed name, or an error string. */
function validateName(kind, raw) {
  const name = String(raw ?? '').trim();
  if (!name) return { error: 'Name is required' };
  if (name.length > MAX_LENGTH[kind]) return { error: `Name must be ${MAX_LENGTH[kind]} characters or fewer` };
  return { name };
}

/** Makes sure every name exists as a label of `kind` (no-op for those that do).
 * Called by the menu controller on save, so labels are never missing. */
async function ensure(kind, names) {
  const clean = [...new Set(names.map((n) => String(n ?? '').trim()).filter(Boolean))];
  if (clean.length === 0) return;
  await Label.bulkWrite(clean.map((name) => ({
    updateOne: { filter: { kind, name }, update: { $setOnInsert: { kind, name } }, upsert: true },
  })));
}

function kindOf(req, res) {
  const { kind } = req.params;
  if (!KINDS.includes(kind)) {
    res.status(404).json({ error: 'Unknown label kind' });
    return null;
  }
  return kind;
}

/** All labels of a kind with how many menu items use each. */
async function list(req, res) {
  const kind = kindOf(req, res);
  if (!kind) return;
  const [labels, items] = await Promise.all([
    Label.find({ kind }).sort({ name: 1 }),
    MenuItem.find({}, { category: 1, tags: 1 }),
  ]);
  const counts = {};
  for (const i of items) {
    const used = kind === 'category' ? [i.category] : (i.tags ?? []);
    for (const n of used) counts[n] = (counts[n] || 0) + 1;
  }
  res.json(labels.map((l) => ({ _id: l._id, name: l.name, itemCount: counts[l.name] || 0 })));
}

async function create(req, res) {
  const kind = kindOf(req, res);
  if (!kind) return;
  const { name, error } = validateName(kind, req.body.name);
  if (error) return res.status(400).json({ error });
  if (await Label.exists({ kind, name })) return res.status(409).json({ error: `That ${kind} already exists` });
  const label = await Label.create({ kind, name });
  res.status(201).json({ _id: label._id, name: label.name, itemCount: 0 });
}

/** Rename — and carry the new name onto every item that used the old one. */
async function rename(req, res) {
  const kind = kindOf(req, res);
  if (!kind) return;
  const { name, error } = validateName(kind, req.body.name);
  if (error) return res.status(400).json({ error });
  const label = await Label.findById(req.params.id);
  if (!label || label.kind !== kind) return res.status(404).json({ error: 'Label not found' });
  if (name === label.name) return res.json({ _id: label._id, name, itemCount: await usage(kind, name) });
  if (await Label.exists({ kind, name })) return res.status(409).json({ error: `That ${kind} already exists` });

  const old = label.name;
  label.name = name;
  await label.save();
  if (kind === 'category') {
    await MenuItem.updateMany({ category: old }, { category: name });
  } else {
    // $set on the matched array element; items can't hold a tag twice, so no dedupe needed.
    await MenuItem.updateMany({ tags: old }, { $set: { 'tags.$': name } });
  }
  res.json({ _id: label._id, name, itemCount: await usage(kind, name) });
}

/** Delete — items in a deleted category move to "Other"; a deleted tag is
 * pulled off every item. Neither touches the items themselves. */
async function remove(req, res) {
  const kind = kindOf(req, res);
  if (!kind) return;
  const label = await Label.findById(req.params.id);
  if (!label || label.kind !== kind) return res.status(404).json({ error: 'Label not found' });
  if (kind === 'category' && label.name === FALLBACK_CATEGORY) return res.status(400).json({ error: `"${FALLBACK_CATEGORY}" is where items go when their category is deleted, so it can't be removed` });

  if (kind === 'category') {
    await ensure('category', [FALLBACK_CATEGORY]);
    await MenuItem.updateMany({ category: label.name }, { category: FALLBACK_CATEGORY });
  } else {
    await MenuItem.updateMany({ tags: label.name }, { $pull: { tags: label.name } });
  }
  await label.deleteOne();
  res.status(204).end();
}

async function usage(kind, name) {
  return MenuItem.countDocuments(kind === 'category' ? { category: name } : { tags: name });
}

module.exports = { list, create, rename, remove, ensure, validateName };
