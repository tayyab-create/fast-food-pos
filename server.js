process.loadEnvFile?.();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const menuRouter = require('./routes/menu');
const ordersRouter = require('./routes/orders');
const reportsRouter = require('./routes/reports');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fastfood_pos_ledger')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

app.use('/api/menu', menuRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reports', reportsRouter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Generic error handler — never leak stack traces / file paths to clients.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`POS running at http://localhost:${PORT}`));
