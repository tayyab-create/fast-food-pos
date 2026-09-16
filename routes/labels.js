const express = require('express');
const labelsController = require('../controllers/labelsController');

const router = express.Router();

// :kind is "category" or "tag"
router.get('/:kind', labelsController.list);
router.post('/:kind', labelsController.create);
router.put('/:kind/:id', labelsController.rename);
router.delete('/:kind/:id', labelsController.remove);

module.exports = router;
