const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { madagascarDate } = require('../utils/timezone');

test('Madagascar date follows UTC+3 independently of the host timezone', () => {
  assert.equal(madagascarDate(new Date('2026-10-11T20:59:00Z')), '2026-10-11');
  assert.equal(madagascarDate(new Date('2026-10-11T21:00:00Z')), '2026-10-12');
});

test('historical attendance migration shifts both punches and wraps past midnight', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../Database/migrations/20261012_rh_attendance_madagascar_timezone.sql'), 'utf8');
  assert.match(sql, /check_in = SEC_TO_TIME\(MOD\(TIME_TO_SEC\(check_in\) \+ 10800, 86400\)\)/);
  assert.match(sql, /check_out = SEC_TO_TIME\(MOD\(TIME_TO_SEC\(check_out\) \+ 10800, 86400\)\)/);
  assert.match(sql, /check_in > '08:15:00'/);
});
