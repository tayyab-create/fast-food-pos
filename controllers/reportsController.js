const Order = require('../models/Order');

async function daily(req, res) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const orders = await Order.find({ createdAt: { $gte: start } });

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const itemCounts = {};
  for (const o of orders) {
    for (const i of o.items) {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty;
    }
  }
  const topItems = Object.entries(itemCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty);

  res.json({ orderCount: orders.length, revenue, topItems });
}

module.exports = { daily };
