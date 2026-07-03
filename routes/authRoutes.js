// routes/authRoutes.js
const express = require('express');
const { register, login, me, changePassword } = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', register);        // POST /api/auth/register
router.post('/login', login);               // POST /api/auth/login
router.get('/me', requireAuth, me);         // GET  /api/auth/me
router.post('/change-password', requireAuth, changePassword); // POST /api/auth/change-password

module.exports = router;
