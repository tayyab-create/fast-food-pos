const express = require('express');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/summary', reportsController.summary);
router.get('/popular', reportsController.popular);
router.get('/recent-sales', reportsController.recentSales);

module.exports = router;
