const express = require('express');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/summary', reportsController.summary);
router.get('/popular', reportsController.popular);

module.exports = router;
