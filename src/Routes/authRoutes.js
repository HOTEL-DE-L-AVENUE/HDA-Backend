const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  res.json({ success: true, message: 'Login route', data: req.body });
});

router.post('/register', (req, res) => {
  res.json({ success: true, message: 'Register route', data: req.body });
});

router.get('/me', (req, res) => {
  res.json({ success: true, message: 'Profile route' });
});

module.exports = router;