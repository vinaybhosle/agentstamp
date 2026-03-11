const config = require('./src/config');
const database = require('./src/database');
const cryptoModule = require('./src/crypto');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const rateLimiter = require('./src/middleware/rateLimit');
const healthRoutes = require('./src/routes/health');
const stampRoutes = require('./src/routes/stamp');
const registryRoutes = require('./src/routes/registry');
const wellRoutes = require('./src/routes/well');

// Initialize core systems
database.initialize();
cryptoModule.initialize();

const app = express();

// Security & parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }
  next(err);
});
app.use(rateLimiter);

// x402 payment middleware
(async () => {
  try {
    const x402 = require('x402-express');
    const paymentMiddleware = x402.paymentMiddleware || x402.default?.paymentMiddleware || x402;

    if (typeof paymentMiddleware === 'function') {
      app.use(
        paymentMiddleware(
          config.walletAddress,
          {
            'POST /api/v1/stamp/mint/bronze': { price: '$0.001', network: config.network },
            'POST /api/v1/stamp/mint/silver': { price: '$0.005', network: config.network },
            'POST /api/v1/stamp/mint/gold': { price: '$0.01', network: config.network },
            'POST /api/v1/registry/register': { price: '$0.01', network: config.network },
            'PUT /api/v1/registry/update/[agentId]': { price: '$0.005', network: config.network },
            'POST /api/v1/registry/endorse/[agentId]': { price: '$0.005', network: config.network },
            'POST /api/v1/well/wish': { price: '$0.001', network: config.network },
            'POST /api/v1/well/grant/[wishId]': { price: '$0.005', network: config.network },
          },
          { url: config.facilitatorUrl }
        )
      );
      console.log('x402 payment middleware loaded (PayAI facilitator)');
    } else {
      console.warn('x402-express loaded but paymentMiddleware not found — paid routes unprotected');
    }
  } catch (err) {
    console.warn('x402-express not available — paid routes will work without payment gating:', err.message);
  }

  // Routes
  app.use(healthRoutes);
  app.use('/api/v1/stamp', stampRoutes);
  app.use('/api/v1/registry', registryRoutes);
  app.use('/api/v1/well', wellRoutes);

  // Static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Discovery endpoints
  app.get('/.well-known/mcp.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'discovery', 'mcp.json'));
  });

  app.get('/.well-known/agent-card.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'discovery', 'agent-card.json'));
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  // Periodic cleanup every 10 minutes
  setInterval(() => {
    try { database.cleanupExpired(); } catch (e) { /* ignore */ }
  }, 10 * 60 * 1000);

  // Start server
  app.listen(config.port, config.host, () => {
    console.log(`\n  AgentStamp v1.0.0`);
    console.log(`  Stamp your agent into existence.\n`);
    console.log(`  Server:      http://${config.host}:${config.port}`);
    console.log(`  Health:      http://localhost:${config.port}/health`);
    console.log(`  Landing:     http://localhost:${config.port}/`);
    console.log(`  MCP:         http://localhost:${config.port}/.well-known/mcp.json`);
    console.log(`  Agent Card:  http://localhost:${config.port}/.well-known/agent-card.json`);
    console.log(`  Wallet:      ${config.walletAddress}`);
    console.log(`  Facilitator: ${config.facilitatorUrl}`);
    console.log(`  Network:     ${config.network}\n`);
  });
})();
