const express = require('express');
const router = express.Router();

const startTime = Date.now();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'AgentStamp',
    version: '2.2.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    endpoints: {
      stamp: 5,
      registry: 8,
      well: 6,
      health: 1,
      discovery: 2,
    },
  });
});

module.exports = router;
