// controllers/financeReportingController.js
const reporting = require('../models/financeReportingModel');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/apiResponse');

// GET /api/finance/reports/monthly?department=hotel&year=2026
async function monthlyBreakdownHandler(req, res) {
  const { department, year } = req.query;
  try {
    const rows = await reporting.monthlyDepartmentBreakdown({
      department: department || undefined,
      year: year !== undefined ? Number(year) : undefined,
    });
    return ok(res, rows);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

// GET /api/finance/reports/monthly/:department/:year/:month
async function departmentMonthHandler(req, res) {
  const { department, year, month } = req.params;
  try {
    const row = await reporting.departmentMonthSummary({ department, year, month });
    return ok(res, row);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

module.exports = { monthlyBreakdownHandler, departmentMonthHandler };
