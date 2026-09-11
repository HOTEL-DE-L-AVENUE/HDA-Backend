const express = require('express');
const ctrl = require('../controllers/rhController');
const { requireAuth } = require('../middlewares/auth');
const router = express.Router();

function requireHR(req, res, next) {
  let modules = req.user?.module;
  if (typeof modules === 'string') { try { modules = JSON.parse(modules); } catch { modules = modules.split(','); } }
  modules = (Array.isArray(modules) ? modules : []).map((item) => String(item).trim().toLowerCase());
  if (req.user?.role === 'admin' || req.user?.role === 'rh_manager' || req.user?.role === 'rh' || modules.includes('rh')) return next();
  return next(require('../utils/ApiError').forbidden('Accès RH réservé aux personnes autorisées'));
}
router.use(requireAuth, requireHR);
router.get('/dashboard', ctrl.dashboard);
router.get('/employees', ctrl.employeesList); router.post('/employees', ctrl.createEmployee); router.get('/employees/:id', ctrl.getEmployee); router.put('/employees/:id', ctrl.updateEmployee); router.post('/employees/:id/offboard', ctrl.offboardEmployee);
router.get('/leave-requests', ctrl.leaveList); router.post('/leave-requests', ctrl.leaveCreate); router.patch('/leave-requests/:id/status', ctrl.leaveStatus);
router.get('/attendance', ctrl.attendanceList); router.post('/attendance/check-in', ctrl.checkIn); router.post('/attendance/check-out', ctrl.checkOut);
router.get('/payroll', ctrl.payrollList); router.post('/payroll/:period/generate', ctrl.payrollGenerate); router.patch('/payroll/:id', ctrl.payrollUpdate); router.patch('/payroll/:id/status', ctrl.payrollStatus); router.get('/payroll/:period/payslip/:employeeId', ctrl.payrollPayslip);
router.get('/evaluations', ctrl.evaluationsCrud.list); router.post('/evaluations', ctrl.evaluationCreate); router.get('/evaluations/:id', ctrl.evaluationsCrud.getOne); router.put('/evaluations/:id', ctrl.evaluationsCrud.update);
module.exports = router;
