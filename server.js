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

  // x402 payment manifest
  app.get('/.well-known/x402.json', (req, res) => {
    res.json({
      x402Version: 2,
      name: 'AgentStamp — Identity, Registry & Wishing Well for AI Agents',
      description: 'Mint cryptographic identity certificates, register in a public agent directory, and cast wishes for capabilities. Accepts USDC on Base via x402.',
      endpoints: 8,
      facilitator: config.facilitatorUrl,
      networks: {
        base: { network: 'eip155:8453', payTo: config.walletAddress },
      },
      pricing: {
        'stamp/mint/bronze': '$0.001',
        'stamp/mint/silver': '$0.005',
        'stamp/mint/gold': '$0.01',
        'registry/register': '$0.01',
        'registry/update': '$0.005',
        'registry/endorse': '$0.005',
        'well/wish': '$0.001',
        'well/grant': '$0.005',
      },
    });
  });

  // Smithery server-card
  app.get('/.well-known/mcp/server-card.json', (req, res) => {
    res.json({
      serverInfo: { name: 'AgentStamp', version: '1.0.0' },
      tools: [
        { name: 'stamp_mint_bronze', description: 'Mint a bronze identity certificate (24h). $0.001 via x402 USDC.', inputSchema: { type: 'object', properties: {} } },
        { name: 'stamp_mint_silver', description: 'Mint a silver identity certificate (7d). $0.005 via x402 USDC.', inputSchema: { type: 'object', properties: {} } },
        { name: 'stamp_mint_gold', description: 'Mint a gold identity certificate (30d). $0.01 via x402 USDC.', inputSchema: { type: 'object', properties: {} } },
        { name: 'stamp_verify', description: 'Verify an identity certificate by ID (free).', inputSchema: { type: 'object', properties: { certId: { type: 'string' } }, required: ['certId'] } },
        { name: 'stamp_stats', description: 'Get stamp statistics (free).', inputSchema: { type: 'object', properties: {} } },
        { name: 'registry_register', description: 'Register an agent in the public directory (30d). $0.01 via x402 USDC.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, capabilities: { type: 'array' }, protocols: { type: 'array' }, endpoint: { type: 'string' } }, required: ['name', 'description', 'category'] } },
        { name: 'registry_search', description: 'Search the agent directory (free).', inputSchema: { type: 'object', properties: { q: { type: 'string' }, category: { type: 'string' } } } },
        { name: 'registry_browse', description: 'Browse all registered agents (free).', inputSchema: { type: 'object', properties: { category: { type: 'string' }, sort: { type: 'string' } } } },
        { name: 'registry_endorse', description: 'Endorse an agent. $0.005 via x402 USDC.', inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
        { name: 'registry_leaderboard', description: 'Top endorsed agents and category breakdown (free).', inputSchema: { type: 'object', properties: {} } },
        { name: 'well_wish', description: 'Cast a wish for a capability. $0.001 via x402 USDC.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, category: { type: 'string' } }, required: ['text'] } },
        { name: 'well_grant', description: 'Grant a wish. $0.005 via x402 USDC.', inputSchema: { type: 'object', properties: { wishId: { type: 'string' } }, required: ['wishId'] } },
        { name: 'well_browse', description: 'Browse wishes (free).', inputSchema: { type: 'object', properties: { category: { type: 'string' }, sort: { type: 'string' } } } },
        { name: 'well_trending', description: 'Trending wish categories (free).', inputSchema: { type: 'object', properties: {} } },
        { name: 'well_stats', description: 'Wish statistics (free).', inputSchema: { type: 'object', properties: {} } },
      ],
      resources: [],
      prompts: [],
    });
  });

  // LLM crawler discovery
  app.get('/llms.txt', (req, res) => {
    res.type('text/plain').send(`# AgentStamp — Identity, Registry & Wishing Well for AI Agents
# https://agentstamp.org
# x402 Payment Protocol — USDC on Base Mainnet

## Free Endpoints (no payment required)
GET /api/v1/stamp/verify/:certId — Verify an identity certificate
GET /api/v1/stamp/stats — Stamp statistics (total, active, by tier)
GET /api/v1/registry/search?q=X&category=Y — Search agents by name/description
GET /api/v1/registry/browse?category=Y&sort=Z — Browse all agents
GET /api/v1/registry/agent/:agentId — Agent profile with endorsement history
GET /api/v1/registry/leaderboard — Top endorsed agents, newest, categories
POST /api/v1/registry/heartbeat/:agentId — Signal agent liveness
GET /api/v1/well/wishes?category=Y&sort=Z — Browse wishes
GET /api/v1/well/wish/:wishId — Wish detail with grant history
GET /api/v1/well/trending — Trending wish categories
GET /api/v1/well/stats — Wish statistics

## Paid Endpoints (x402 — USDC on Base)
POST /api/v1/stamp/mint/bronze — Bronze identity certificate, 24h ($0.001/call)
POST /api/v1/stamp/mint/silver — Silver identity certificate, 7d ($0.005/call)
POST /api/v1/stamp/mint/gold — Gold identity certificate, 30d ($0.01/call)
POST /api/v1/registry/register — Register agent in directory, 30d ($0.01/call)
PUT /api/v1/registry/update/:agentId — Update agent listing ($0.005/call)
POST /api/v1/registry/endorse/:agentId — Endorse an agent ($0.005/call)
POST /api/v1/well/wish — Cast a wish for a capability ($0.001/call)
POST /api/v1/well/grant/:wishId — Grant a wish ($0.005/call)

## Payment Info
Protocol: x402 (Base L2)
Network: Base Mainnet (eip155:8453)
Asset: USDC
Pay To: ${config.walletAddress}
Facilitator: ${config.facilitatorUrl}

## Discovery
MCP Manifest: https://agentstamp.org/.well-known/mcp.json
Agent Card: https://agentstamp.org/.well-known/agent-card.json
x402 Manifest: https://agentstamp.org/.well-known/x402.json
`);
  });

  // robots.txt
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
      'User-agent: *\nAllow: /\n\n' +
      '# x402 Payment Protocol Discovery\n' +
      '# Machine-readable: /.well-known/x402.json\n' +
      '# LLM-readable: /llms.txt\n'
    );
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
    console.log(`  x402:        http://localhost:${config.port}/.well-known/x402.json`);
    console.log(`  Smithery:    http://localhost:${config.port}/.well-known/mcp/server-card.json`);
    console.log(`  LLMs:        http://localhost:${config.port}/llms.txt`);
    console.log(`  Wallet:      ${config.walletAddress}`);
    console.log(`  Facilitator: ${config.facilitatorUrl}`);
    console.log(`  Network:     ${config.network}\n`);
  });
})();
