const express = require('express');
const ctrl = require('../controllers/rhController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const managementRoles = requireRole('admin', 'manager');
router.use(requireAuth);
router.use(managementRoles);

router.get('/dashboard', ctrl.dashboard);
router.get('/employees', ctrl.employeesList);
router.post('/employees', ctrl.createEmployee);
router.put('/employees/:id', ctrl.employeesCrud.update);
router.delete('/employees/:id', ctrl.employeesCrud.remove);
router.get('/leave-requests', ctrl.leaveList);
router.patch('/leave-requests/:id/status', ctrl.leaveStatus);
router.get('/attendance', ctrl.attendanceList);
router.get('/payroll', ctrl.payrollList);

module.exports = router;
