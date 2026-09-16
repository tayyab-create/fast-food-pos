const express = require('express');
const multer = require('multer');
const menuController = require('../controllers/menuController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, or WebP images are allowed'));
    }
    cb(null, true);
  },
});

function handleImageUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    next();
  });
}

router.get('/', menuController.list);
router.post('/', menuController.create);
router.put('/:id', menuController.update);
router.delete('/:id', menuController.remove);
router.post('/:id/image', handleImageUpload, menuController.uploadImage);
router.post('/:id/image-url', menuController.uploadImageFromUrl);
router.delete('/:id/image', menuController.removeImage);

module.exports = router;
