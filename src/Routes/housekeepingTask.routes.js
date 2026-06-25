const express = require('express');
const router = express.Router();
const taskController = require('../Controllers/housekeepingTask.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken, taskController.getTasks);
router.get('/stats', authenticateToken, taskController.getTaskStats);
router.get('/room/:roomId', authenticateToken, taskController.getTasksByRoom);
router.get('/user/:userId', authenticateToken, taskController.getTasksByUser);
router.get('/:id', authenticateToken, taskController.getTaskById);
router.post('/', authenticateToken, taskController.createTask);
router.put('/:id', authenticateToken, taskController.updateTask);
router.put('/:id/status', authenticateToken, taskController.updateTaskStatus);
router.delete('/:id', authenticateToken, taskController.deleteTask);

module.exports = router;