const express = require('express');
const ordersController = require('../controllers/ordersController');

const router = express.Router();

router.get('/', ordersController.list);
router.post('/', ordersController.create);
router.patch('/:id', ordersController.updateStatus);

module.exports = router;
