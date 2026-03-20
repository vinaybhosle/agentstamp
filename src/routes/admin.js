const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDb } = require('../database');
const { runFullReport } = require('../dataQualityChecks');

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const key = process.env.AUTH_SECRET || process.env.ANALYTICS_KEY;
  if (!key) return false; // fail-closed: no secret configured
  const hashA = crypto.createHmac('sha256', key).update(a).digest();
  const hashB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function requireAnalyticsKey(req, res, next) {
  const key = req.headers['x-analytics-key'];
  const expected = process.env.ANALYTICS_KEY;
  if (!expected) return res.status(503).json({ error: 'Analytics not configured' });
  if (!key || !timingSafeEqual(key, expected)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(requireAnalyticsKey);

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
