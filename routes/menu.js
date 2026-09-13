const express = require('express');
const menuController = require('../controllers/menuController');

const router = express.Router();

router.get('/', menuController.list);
router.post('/', menuController.create);
router.put('/:id', menuController.update);
router.delete('/:id', menuController.remove);

module.exports = router;
