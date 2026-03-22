const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { runFullReport } = require('../dataQualityChecks');
const { timingSafeCompare } = require('../utils/timingSafeCompare');

function requireAdminKey(req, res, next) {
  const key = req.headers['x-analytics-key'];
  const expected = process.env.AUTH_SECRET;
  if (!expected) return res.status(503).json({ error: 'Admin not configured' });
  if (!key || !timingSafeCompare(key, expected, expected)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(requireAdminKey);

// GET /api/v1/admin/db-quality — Run data quality checks
router.get('/db-quality', (req, res) => {
  try {
    const db = getDb();
    const report = runFullReport(db);
    res.json({ success: true, ...report });
  } catch (err) {
    console.error('DB quality check error:', err);
    res.status(500).json({ success: false, error: 'Failed to run quality checks' });
  }
});

module.exports = router;
