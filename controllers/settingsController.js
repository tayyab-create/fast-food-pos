const Settings = require('../models/Settings');

const MIN_OPTIONS = 1;
const MAX_OPTIONS = 8;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 500;

/** Returns an error string, or null if `pageSizeOptions` is well-formed:
 * a short list of distinct positive whole numbers. */
function validatePageSizeOptions(pageSizeOptions) {
  if (!Array.isArray(pageSizeOptions) || pageSizeOptions.length < MIN_OPTIONS) return 'Enter at least one page size';
  if (pageSizeOptions.length > MAX_OPTIONS) return `At most ${MAX_OPTIONS} page sizes`;
  for (const n of pageSizeOptions) {
    if (!Number.isInteger(n) || n < MIN_PAGE_SIZE || n > MAX_PAGE_SIZE) {
      return `Each page size must be a whole number between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`;
    }
  }
  if (new Set(pageSizeOptions).size !== pageSizeOptions.length) return 'Page sizes must be unique';
  return null;
}

async function get(req, res) {
  const settings = await Settings.findByIdAndUpdate(
    'app',
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json(settings);
}

async function update(req, res) {
  const { pageSizeOptions } = req.body;
  const error = validatePageSizeOptions(pageSizeOptions);
  if (error) return res.status(400).json({ error });
  const sorted = [...pageSizeOptions].sort((a, b) => a - b);
  const settings = await Settings.findByIdAndUpdate(
    'app',
    { pageSizeOptions: sorted },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json(settings);
}

module.exports = { get, update, validatePageSizeOptions };
