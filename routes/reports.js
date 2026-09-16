const express = require('express');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/daily', reportsController.daily);

module.exports = router;
