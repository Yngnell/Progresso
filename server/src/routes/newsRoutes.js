const express = require('express');
const router = express.Router();

const { getNews, getNewsItem, createNews, updateNews, deleteNews } = require('../controllers/newsController');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');

// Public (optionalAuth so admins browsing the site still see drafts/all)
router.get('/', optionalAuth, getNews);
router.get('/:id', optionalAuth, getNewsItem);

// Admin only
router.post('/', protect, restrictTo('ADMIN'), createNews);
router.put('/:id', protect, restrictTo('ADMIN'), updateNews);
router.delete('/:id', protect, restrictTo('ADMIN'), deleteNews);

module.exports = router;
