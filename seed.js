process.loadEnvFile?.();

const mongoose = require('mongoose');
const MenuItem = require('./models/MenuItem');

const items = [
  { name: 'Cheeseburger', price: 5.99, category: 'Burgers' },
  { name: 'Double Cheeseburger', price: 7.99, category: 'Burgers' },
  { name: 'Chicken Burger', price: 6.49, category: 'Burgers' },
  { name: 'Fries (Small)', price: 2.49, category: 'Sides' },
  { name: 'Fries (Large)', price: 3.49, category: 'Sides' },
  { name: 'Onion Rings', price: 3.99, category: 'Sides' },
  { name: 'Cola', price: 1.99, category: 'Drinks' },
  { name: 'Lemonade', price: 2.29, category: 'Drinks' },
  { name: 'Milkshake', price: 3.99, category: 'Drinks' },
  { name: 'Apple Pie', price: 2.99, category: 'Desserts' },
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fastfood_pos_ledger').then(async () => {
  await MenuItem.deleteMany({});
  await MenuItem.insertMany(items);
  console.log(`Seeded ${items.length} menu items`);
  mongoose.disconnect();
});
