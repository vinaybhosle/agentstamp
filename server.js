require('./instrument'); // Sentry — must be first import
const config = require('./src/config');
const database = require('./src/database');
const cryptoModule = require('./src/crypto');
const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { globalLimiter, mutationLimiter, readLimiter, analyticsLimiter } = require('./src/middleware/rateLimit');
const requestTracker = require('./src/middleware/requestTracker');
const healthRoutes = require('./src/routes/health');
const stampRoutes = require('./src/routes/stamp');
const registryRoutes = require('./src/routes/registry');
const wellRoutes = require('./src/routes/well');
const passportRoutes = require('./src/routes/passport');
const analyticsRoutes = require('./src/routes/analytics');
const badgeRoutes = require('./src/routes/badge');
const webhookRoutes = require('./src/routes/webhook');
const trustRoutes = require('./src/routes/trust');
const adminRoutes = require('./src/routes/admin');
const walletRoutes = require('./src/routes/wallet');
const auditRoutes = require('./src/routes/audit');
const bridgeRoutes = require('./src/routes/bridge');
const complianceRoutes = require('./src/routes/compliance');
const discoveryRoutes = require('./src/routes/discovery');
const { mountMcpOnExpress } = require('./src/mcp-server');

// Initialize core systems
database.initialize();
cryptoModule.initialize();

const app = express();

// Trust first proxy (Cloudflare Tunnel) so X-Forwarded-For is used correctly
// by express-rate-limit and other middleware
app.set('trust proxy', 1);

// Security & parsing
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://agentstamp.org"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://agentstamp.org',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-wallet-address', 'x-wallet-signature', 'x-wallet-timestamp', 'x-analytics-key', 'X-PAYMENT', 'PAYMENT', 'PAYMENT-SIGNATURE'],
}));
// Additional security headers (from security-hardening audit)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
// Skip JSON body parsing for /mcp — the MCP transport reads the raw stream
app.use((req, res, next) => {
  if (req.path === '/mcp') return next();
  express.json({ limit: '100kb' })(req, res, next);
});
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }
  next(err);
});
app.use(globalLimiter);

// Request tracking — logs every API hit for traffic analytics
app.use(requestTracker(database.getDb));

// No-cache for all API and health responses (JSON only, not static assets)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/health', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Track whether x402 payment middleware loaded successfully (fail-CLOSED)
let x402Loaded = false;

// Paid route patterns — used by fail-closed guard when x402 isn't available
const PAID_ROUTE_PATTERNS = [
  { method: 'POST', path: '/api/v1/stamp/mint/' },
  { method: 'POST', path: '/api/v1/registry/register' },
  { method: 'PUT', path: '/api/v1/registry/update/' },
  { method: 'POST', path: '/api/v1/registry/endorse/' },
  { method: 'POST', path: '/api/v1/well/wish' },
  { method: 'POST', path: '/api/v1/well/grant/' },
  { method: 'GET', path: '/api/v1/well/insights', exact: true },
  { method: 'POST', path: '/api/v1/bridge/erc8004/link', exact: true },
];

// x402 payment middleware (V2 — dual-chain: Base + Solana)
(async () => {
  try {
    const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
    const { ExactEvmScheme } = require('@x402/evm/exact/server');
    const { ExactSvmScheme } = require('@x402/svm/exact/server');
    const { HTTPFacilitatorClient } = require('@x402/core/server');
    const { declareDiscoveryExtension } = require('@x402/extensions/bazaar');

    const BASE_NETWORK = 'eip155:8453';
    const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

    const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(BASE_NETWORK, new ExactEvmScheme())
      .register('solana:*', new ExactSvmScheme());

    function dualChainAccepts(price) {
      const accepts = [
        { scheme: 'exact', price, network: BASE_NETWORK, payTo: config.walletAddress },
      ];
      if (config.solanaWalletAddress) {
        accepts.push({ scheme: 'exact', price, network: SOLANA_NETWORK, payTo: config.solanaWalletAddress });
      }
      return accepts;
    }

    const bazaar = (config) => ({ extensions: { ...declareDiscoveryExtension(config) } });

    const paidRoutes = {
      'POST /api/v1/stamp/mint/bronze': {
        accepts: dualChainAccepts('$0.001'),
        description: 'Mint bronze identity certificate (24h)',
        ...bazaar({ bodyType: 'json', input: { wallet_address: '0x...', name: 'MyAgent' }, output: { example: { certId: 'cert_abc123', tier: 'bronze', expiresAt: '2026-03-22T00:00:00Z', signature: 'base64...' } } }),
      },
      'POST /api/v1/stamp/mint/silver': {
        accepts: dualChainAccepts('$0.005'),
        description: 'Mint silver identity certificate (7d)',
        ...bazaar({ bodyType: 'json', input: { wallet_address: '0x...', name: 'MyAgent' }, output: { example: { certId: 'cert_abc123', tier: 'silver', expiresAt: '2026-03-28T00:00:00Z', signature: 'base64...' } } }),
      },
      'POST /api/v1/stamp/mint/gold': {
        accepts: dualChainAccepts('$0.01'),
        description: 'Mint gold identity certificate (30d)',
        ...bazaar({ bodyType: 'json', input: { wallet_address: '0x...', name: 'MyAgent' }, output: { example: { certId: 'cert_abc123', tier: 'gold', expiresAt: '2026-04-20T00:00:00Z', signature: 'base64...' } } }),
      },
      'POST /api/v1/registry/register': {
        accepts: dualChainAccepts('$0.01'),
        description: 'Register agent in directory (30d)',
        ...bazaar({ bodyType: 'json', input: { name: 'MyAgent', description: 'An AI agent', category: 'infrastructure', capabilities: ['search'], endpoint: 'https://example.com' }, output: { example: { agentId: 'agent_abc123', registered: true, expiresAt: '2026-04-20T00:00:00Z' } } }),
      },
      'PUT /api/v1/registry/update/[agentId]': {
        accepts: dualChainAccepts('$0.005'),
        description: 'Update agent listing',
        ...bazaar({ bodyType: 'json', input: { description: 'Updated description' }, output: { example: { updated: true } } }),
      },
      'POST /api/v1/registry/endorse/[agentId]': {
        accepts: dualChainAccepts('$0.005'),
        description: 'Endorse an agent',
        ...bazaar({ bodyType: 'json', input: { comment: 'Reliable agent' }, output: { example: { endorsementId: 'end_abc123', endorsed: true } } }),
      },
      'POST /api/v1/well/wish': {
        accepts: dualChainAccepts('$0.001'),
        description: 'Cast a wish for a capability',
        ...bazaar({ bodyType: 'json', input: { text: 'I wish for better search', category: 'capability' }, output: { example: { wishId: 'wish_abc123', status: 'open' } } }),
      },
      'POST /api/v1/well/grant/[wishId]': {
        accepts: dualChainAccepts('$0.005'),
        description: 'Grant a wish',
        ...bazaar({ bodyType: 'json', input: { response: 'Here is how I can help' }, output: { example: { granted: true, grantId: 'grant_abc123' } } }),
      },
      'GET /api/v1/well/insights': {
        accepts: dualChainAccepts('$0.01'),
        description: 'Market insights on what AI agents want',
        ...bazaar({ output: { example: { totalWishes: 150, topCategories: ['capability', 'integration', 'data'], grantRate: 0.42 } } }),
      },
      'POST /api/v1/bridge/erc8004/link': {
        accepts: dualChainAccepts('$0.01'),
        description: 'Link ERC-8004 on-chain agent to AgentStamp trust layer',
        ...bazaar({ bodyType: 'json', input: { erc8004AgentId: '12345', wallet_address: '0x...' }, output: { example: { linked: true, trustScore: 72 } } }),
      },
    };

    app.use(paymentMiddleware(paidRoutes, resourceServer));

    // x402 payment replay detection — persistent dedup (SQLite-backed + in-memory L1 cache)
    const seenPayments = new Map(); // L1 cache: hash → timestamp
    const PAYMENT_DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

    // Pre-load recent hashes from DB into L1 cache on startup
    try {
      const db = database.getDb();
      const recent = db.prepare(
        "SELECT hash FROM payment_hashes WHERE created_at > datetime('now', '-24 hours')"
      ).all();
      for (const row of recent) {
        seenPayments.set(row.hash, Date.now());
      }
      if (recent.length > 0) {
        console.log(`Loaded ${recent.length} payment hashes from DB into replay cache`);
      }
    } catch (e) { /* best-effort on startup */ }

    // Periodic cleanup: purge expired hashes from both cache and DB
    setInterval(() => {
      const cutoff = Date.now() - PAYMENT_DEDUP_TTL_MS;
      for (const [hash, ts] of seenPayments) {
        if (ts < cutoff) seenPayments.delete(hash);
      }
      try {
        database.getDb().prepare(
          "DELETE FROM payment_hashes WHERE created_at < datetime('now', '-24 hours')"
        ).run();
      } catch (e) { /* best-effort */ }
    }, 5 * 60_000); // every 5 minutes

    app.use((req, res, next) => {
      const paymentHeader = req.headers['x-payment'] || req.headers['payment'];
      if (!paymentHeader) return next();
      const paymentHash = crypto.createHash('sha256').update(paymentHeader).digest('hex');

      // L1 cache check (fast path)
      if (seenPayments.has(paymentHash)) {
        return res.status(409).json({ success: false, error: 'Duplicate payment token — possible replay attack' });
      }

      // L2 DB check (survives restarts) — atomic check-and-insert to prevent race conditions
      try {
        const db = database.getDb();
        const isDuplicate = db.transaction((hash) => {
          const existing = db.prepare('SELECT 1 FROM payment_hashes WHERE hash = ?').get(hash);
          if (existing) return true;
          // INSERT OR IGNORE handles the rare case where another transaction inserts between SELECT and INSERT
          db.prepare('INSERT OR IGNORE INTO payment_hashes (hash) VALUES (?)').run(hash);
          return false;
        })(paymentHash);

        if (isDuplicate) {
          seenPayments.set(paymentHash, Date.now()); // warm L1 cache
          return res.status(409).json({ success: false, error: 'Duplicate payment token — possible replay attack' });
        }
      } catch (e) { /* if DB write fails, L1 cache still catches within this process lifecycle */ }

      seenPayments.set(paymentHash, Date.now());
      next();
    });

    x402Loaded = true;
    console.log('x402 payment middleware loaded (V2 dual-chain: Base + Solana)');
  } catch (err) {
    console.error('CRITICAL: x402 middleware failed to load — paid routes will return 503:', err.message);
  }

  // Free-tier endpoints that should work even when x402 is unavailable
  // IMPORTANT: These are checked BEFORE paid routes — order matters for /stamp/mint/free vs /stamp/mint/:tier
  const FREE_ROUTE_PATTERNS = [
    { method: 'POST', path: '/api/v1/stamp/mint/free', exact: true },
    { method: 'POST', path: '/api/v1/registry/register/free', exact: true },
  ];

  // Fail-closed guard: if x402 didn't load, block all paid routes with 503
  // but allow free-tier endpoints through
  app.use((req, res, next) => {
    if (x402Loaded) return next();
    // Free routes pass through even when x402 is down (exact match only)
    const isFree = FREE_ROUTE_PATTERNS.some(
      (r) => req.method === r.method && req.path === r.path
    );
    if (isFree) return next();
    // Paid routes get blocked with 503 (prefix match unless exact flag set)
    const isPaid = PAID_ROUTE_PATTERNS.some(
      (r) => req.method === r.method && (r.exact ? req.path === r.path : req.path.startsWith(r.path))
    );
    if (isPaid) {
      return res.status(503).json({
        success: false,
        error: 'Payment service unavailable. Please try again later.',
      });
    }
    next();
  });

  // Wallet validation middleware — reject mutation requests without a wallet address
  // (instead of defaulting to 0x000...000 which allows unauthenticated actions)
  const WALLET_REQUIRED_PATTERNS = [
    { method: 'POST', path: '/api/v1/stamp/mint/' },
    { method: 'POST', path: '/api/v1/registry/register' },
    { method: 'PUT', path: '/api/v1/registry/update/' },
    { method: 'POST', path: '/api/v1/registry/endorse/' },
    { method: 'POST', path: '/api/v1/well/wish' },
    { method: 'POST', path: '/api/v1/well/grant/' },
    { method: 'POST', path: '/api/v1/wallet/link' },
    { method: 'POST', path: '/api/v1/wallet/unlink' },
    { method: 'POST', path: '/api/v1/bridge/erc8004/link' },
  ];
  app.use((req, res, next) => {
    const needsWallet = WALLET_REQUIRED_PATTERNS.some(
      (r) => req.method === r.method && req.path.startsWith(r.path)
    );
    if (!needsWallet) return next();

    const wallet = req.headers['x-wallet-address'] || (req.body && req.body.wallet_address);
    if (!wallet || wallet === '0x0000000000000000000000000000000000000000') {
      return res.status(401).json({
        success: false,
        error: 'Wallet address required. Provide x-wallet-address header or wallet_address in body.',
      });
    }
    // Validate wallet format (EVM: 0x + 40 hex, or Solana: base58 32-44 chars)
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(wallet);
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
    if (!isEvm && !isSolana) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format. Expected Ethereum (0x + 40 hex) or Solana (base58, 32-44 chars).',
      });
    }
    next();
  });

  // Routes — with per-route rate limiters layered on top of global
  app.use(healthRoutes);
  app.use('/api/v1/stamp', mutationLimiter, stampRoutes);
  app.use('/api/v1/registry', readLimiter, registryRoutes);
  app.use('/api/v1/well', mutationLimiter, wellRoutes);
  app.use('/api/v1/passport', readLimiter, passportRoutes);
  app.use('/api/v1/analytics', analyticsLimiter, analyticsRoutes);
  app.use('/api/v1/badge', readLimiter, badgeRoutes);
  app.use('/api/v1/webhooks', mutationLimiter, webhookRoutes);
  app.use('/api/v1/trust', readLimiter, trustRoutes);
  app.use('/api/v1/wallet', mutationLimiter, walletRoutes);
  app.use('/api/v1/bridge', readLimiter, bridgeRoutes);
  app.use('/api/v1/admin', analyticsLimiter, adminRoutes);
  app.use('/api/v1/audit', readLimiter, auditRoutes);
  app.use('/api/v1/compliance', readLimiter, complianceRoutes);
  app.use('/api/v1/discovery', readLimiter, discoveryRoutes);

  // MCP server (Streamable HTTP transport)
  mountMcpOnExpress(app, '/mcp');

  // Static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Discovery endpoints
  app.get('/.well-known/mcp.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'discovery', 'mcp.json'));
  });

  // Passport public key for verification
  app.get('/.well-known/passport-public-key', (req, res) => {
    res.json({
      algorithm: 'Ed25519',
      public_key: cryptoModule.getPublicKey(),
      usage: 'Verify AgentStamp passport signatures. The passport data (excluding the signature field) is JSON-canonicalized (keys sorted) and signed with Ed25519.',
    });
  });

  app.get('/.well-known/agent-card.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'discovery', 'agent-card.json'));
  });

  // x402 payment manifest
  app.get('/.well-known/x402.json', (req, res) => {
    res.json({
      x402Version: 2,
      name: 'AgentStamp — Identity, Registry & Wishing Well for AI Agents',
      description: 'Mint cryptographic identity certificates, register in a public agent directory, and cast wishes for capabilities. Accepts USDC on Base and Solana via x402.',
      endpoints: 8,
      facilitator: config.facilitatorUrl,
      networks: {
        base: { network: 'eip155:8453', payTo: config.walletAddress },
        ...(config.solanaWalletAddress ? { solana: { network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', payTo: config.solanaWalletAddress } } : {}),
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
        'well/insights': '$0.01',
        'bridge/erc8004/link': '$0.01',
      },
    });
  });

  // Smithery server-card
  app.get('/.well-known/mcp/server-card.json', (req, res) => {
    res.json({
      serverInfo: { name: 'AgentStamp', version: '2.0.0' },
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
        { name: 'agent_reputation', description: 'Get agent reputation score (0-100) with full breakdown (free).', inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
        { name: 'well_wish', description: 'Cast a wish for a capability. $0.001 via x402 USDC.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, category: { type: 'string' } }, required: ['text'] } },
        { name: 'well_grant', description: 'Grant a wish. $0.005 via x402 USDC.', inputSchema: { type: 'object', properties: { wishId: { type: 'string' } }, required: ['wishId'] } },
        { name: 'well_browse', description: 'Browse wishes (free).', inputSchema: { type: 'object', properties: { category: { type: 'string' }, sort: { type: 'string' } } } },
        { name: 'well_trending', description: 'Trending wish categories (free).', inputSchema: { type: 'object', properties: {} } },
        { name: 'well_stats', description: 'Wish statistics (free).', inputSchema: { type: 'object', properties: {} } },
        { name: 'well_insights', description: 'Market insights: what AI agents want. $0.01 via x402 USDC.', inputSchema: { type: 'object', properties: {} } },
        { name: 'get_passport', description: 'Get signed agent passport by wallet address (free).', inputSchema: { type: 'object', properties: { walletAddress: { type: 'string' } }, required: ['walletAddress'] } },
        { name: 'get_a2a_card', description: 'Get A2A agent card for Google A2A protocol (free).', inputSchema: { type: 'object', properties: { walletAddress: { type: 'string' } }, required: ['walletAddress'] } },
        { name: 'trust_check', description: 'Single-call trust verdict for any wallet address. Returns trusted/untrusted with score, tier, agent info, and upgrade hints (free).', inputSchema: { type: 'object', properties: { walletAddress: { type: 'string' } }, required: ['walletAddress'] } },
        { name: 'trust_compare', description: 'Compare trust scores of up to 5 wallets side-by-side. See who leads and by how much (free).', inputSchema: { type: 'object', properties: { wallets: { type: 'array', items: { type: 'string' } } }, required: ['wallets'] } },
        { name: 'trust_network', description: 'Network-wide trust statistics: active agents, stamps, endorsements, average reputation, top categories (free).', inputSchema: { type: 'object', properties: {} } },
      ],
      resources: [],
      prompts: [],
    });
  });

  // LLM crawler discovery
  app.get('/llms.txt', (req, res) => {
    res.type('text/plain').send(`# AgentStamp — AI Agent Identity & Trust Platform
> AgentStamp provides cryptographic identity certificates (stamps), a searchable public registry, reputation scores, and cross-protocol passports for AI agents. Free tier available.

## API
- Base URL: https://agentstamp.org/api/v1
- Free endpoints: search, browse, verify, leaderboard, reputation, passport
- Paid endpoints: mint stamp, register agent, endorse, wish, grant

## Free Registration
- POST /api/v1/stamp/mint/free — Free 7-day identity stamp (wallet address required)
- POST /api/v1/registry/register/free — Free 30-day agent listing (wallet address required)

## Free Endpoints (no payment required)
GET /api/v1/stamp/verify/:certId — Verify an identity certificate
GET /api/v1/stamp/stats — Stamp statistics (total, active, by tier)
GET /api/v1/registry/search?q=X&category=Y — Search agents by name/description
GET /api/v1/registry/browse?category=Y&sort=Z — Browse all agents
GET /api/v1/registry/agent/:agentId — Agent profile with endorsement history and reputation
GET /api/v1/registry/agent/:agentId/reputation — Full reputation score breakdown (0-100)
GET /api/v1/registry/leaderboard — Top endorsed agents, newest, categories
POST /api/v1/registry/heartbeat/:agentId — Signal agent liveness (increments heartbeat count)
GET /api/v1/well/wishes?category=Y&sort=Z — Browse wishes
GET /api/v1/well/wish/:wishId — Wish detail with grant history
GET /api/v1/well/trending — Trending wish categories
GET /api/v1/well/stats — Wish statistics
GET /api/v1/well/insights/preview — Free market insights preview (summary only)
GET /api/v1/passport/:walletAddress — Full signed agent passport (identity + stamp + reputation + A2A card)
GET /api/v1/passport/:walletAddress/a2a — A2A agent card only (Google A2A protocol compatible)
GET /api/v1/badge/:walletAddress — SVG verification badge
GET /api/v1/badge/:walletAddress/json — Badge data as JSON (includes trust nudge for unverified wallets)

## Trust API (FREE — any service can verify agents)
GET /api/v1/trust/check/:walletAddress — Single-call trust verdict: { trusted: true/false, score, tier, agent info }
GET /api/v1/trust/compare?wallets=0x...,0x... — Side-by-side trust comparison (up to 5 wallets)
GET /api/v1/trust/network — Network-wide trust stats (social proof: active agents, stamps, endorsements)
GET /api/v1/trust/pulse — Live network activity feed: recent stamps, registrations, endorsements, wishes with velocity stats
GET /api/v1/trust/check/erc8004:<agentId> — Trust verdict for an ERC-8004 agent by their on-chain ID
GET /api/v1/bridge/erc8004/:agentId — Look up ERC-8004 agent with AgentStamp trust score
GET /api/v1/bridge/erc8004/:agentId/passport — Full AgentStamp passport for an ERC-8004 agent

## Paid Endpoints (x402 — USDC on Base & Solana)
POST /api/v1/stamp/mint/bronze — Bronze identity certificate, 24h ($0.001/call)
POST /api/v1/stamp/mint/silver — Silver identity certificate, 7d ($0.005/call)
POST /api/v1/stamp/mint/gold — Gold identity certificate, 30d ($0.01/call)
POST /api/v1/registry/register — Register agent in directory, 30d ($0.01/call)
PUT /api/v1/registry/update/:agentId — Update agent listing ($0.005/call)
POST /api/v1/registry/endorse/:agentId — Endorse an agent ($0.005/call)
POST /api/v1/well/wish — Cast a wish for a capability ($0.001/call)
POST /api/v1/well/grant/:wishId — Grant a wish ($0.005/call)
GET /api/v1/well/insights — Market insights: what AI agents want ($0.01/call)
POST /api/v1/bridge/erc8004/link — Link ERC-8004 on-chain agent to AgentStamp trust layer ($0.01/call)

## Webhooks (FREE)
POST /api/v1/webhooks/register — Register a webhook (events: stamp_minted, stamp_expiring, endorsement_received, wish_granted)
GET /api/v1/webhooks — List your webhooks
DELETE /api/v1/webhooks/:id — Remove a webhook

## Discovery
MCP Live Server: https://agentstamp.org/mcp (Streamable HTTP — connect with any MCP client)
MCP Manifest: https://agentstamp.org/.well-known/mcp.json
OpenAPI Spec: https://agentstamp.org/.well-known/openapi.json
Agent Card: https://agentstamp.org/.well-known/agent-card.json
x402 Manifest: https://agentstamp.org/.well-known/x402.json
Public Key: https://agentstamp.org/.well-known/passport-public-key

## MCP Tools
- search_agents: Find agents by query/category
- get_agent: Full agent profile by ID
- verify_stamp: Verify identity certificate
- browse_agents: Browse with sort/filter
- get_leaderboard: Top agents and categories
- browse_wishes: Browse capability requests
- get_trending: Trending wish categories
- get_agent_reputation: Reputation score breakdown
- get_passport: Full signed passport
- trust_check: Single-call trust verdict for any wallet address
- trust_compare: Compare trust scores of multiple agents side-by-side
- trust_network: Network-wide trust statistics and social proof

## SDK
- npm install agentstamp-verify
- Express middleware: requireStamp({ minTier: 'free' })
- Hono middleware: requireStamp({ minTier: 'silver' })

## Pricing (USDC on Base & Solana via x402)
- Free stamp: $0 (7d)
- Bronze stamp: $0.001 (24h)
- Silver stamp: $0.005 (7d)
- Gold stamp: $0.01 (30d)
- Agent registration: $0.01 (30d) — or free for 30d
- Endorsement: $0.005
- Cast wish: $0.001
- Grant wish: $0.005
- Market insights: $0.01

## Payment Info
Protocol: x402
Networks: Base Mainnet (eip155:8453), Solana Mainnet
Asset: USDC
Pay To (Base): ${config.walletAddress}
Pay To (Solana): ${config.solanaWalletAddress || 'N/A'}
Facilitator: ${config.facilitatorUrl}
`);
  });

  // OpenAPI specification
  app.get('/.well-known/openapi.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', '.well-known', 'openapi.json'));
  });

  // robots.txt
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
      'User-agent: *\n' +
      'Allow: /\n' +
      'Disallow: /admin\n' +
      'Disallow: /api/v1/admin\n\n' +
      '# AI Agent Discovery\n' +
      '# MCP Server: https://agentstamp.org/mcp\n' +
      '# OpenAPI: https://agentstamp.org/.well-known/openapi.json\n' +
      '# Agent Card: https://agentstamp.org/.well-known/agent-card.json\n' +
      '# AI Plugin: https://agentstamp.org/.well-known/ai-plugin.json\n' +
      '# Agents Discovery: https://agentstamp.org/.well-known/agents.json\n' +
      '# LLMs.txt: https://agentstamp.org/llms.txt\n' +
      '# LLMs Full: https://agentstamp.org/llms-full.txt\n' +
      '# AI Permissions: https://agentstamp.org/ai.txt\n\n' +
      'Sitemap: https://agentstamp.org/sitemap.xml\n'
    );
  });

  // Sitemap
  app.get('/sitemap.xml', (req, res) => {
    // Dynamic sitemap with agent pages
    const db = database.getDb();
    let agentUrls = '';
    try {
      const agents = db.prepare("SELECT id, registered_at FROM agents WHERE status = 'active' LIMIT 100").all();
      for (const a of agents) {
        agentUrls += `  <url><loc>https://agentstamp.org/registry/${a.id}</loc><lastmod>${a.registered_at || new Date().toISOString()}</lastmod><priority>0.6</priority><changefreq>weekly</changefreq></url>\n`;
      }
    } catch (e) { /* best-effort */ }

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://agentstamp.org/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>
  <url><loc>https://agentstamp.org/docs</loc><priority>0.9</priority><changefreq>weekly</changefreq></url>
  <url><loc>https://agentstamp.org/registry</loc><priority>0.9</priority><changefreq>daily</changefreq></url>
  <url><loc>https://agentstamp.org/register</loc><priority>0.8</priority><changefreq>monthly</changefreq></url>
  <url><loc>https://agentstamp.org/leaderboard</loc><priority>0.8</priority><changefreq>daily</changefreq></url>
  <url><loc>https://agentstamp.org/well</loc><priority>0.7</priority><changefreq>daily</changefreq></url>
  <url><loc>https://agentstamp.org/about</loc><priority>0.7</priority><changefreq>monthly</changefreq></url>
  <url><loc>https://agentstamp.org/insights</loc><priority>0.7</priority><changefreq>daily</changefreq></url>
  <url><loc>https://agentstamp.org/verify</loc><priority>0.6</priority><changefreq>monthly</changefreq></url>
  <url><loc>https://agentstamp.org/.well-known/openapi.json</loc><priority>0.5</priority><changefreq>weekly</changefreq></url>
  <url><loc>https://agentstamp.org/llms.txt</loc><priority>0.4</priority><changefreq>weekly</changefreq></url>
${agentUrls}</urlset>`);
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  // Periodic cleanup every 10 minutes
  setInterval(() => {
    try { database.cleanupExpired(); } catch (e) { console.error('Cleanup error:', e.message); }
  }, 10 * 60 * 1000);

  // Sentry error handler — must be after all routes
  const Sentry = require('@sentry/node');
  Sentry.setupExpressErrorHandler(app);

  // Start server
  app.listen(config.port, config.host, () => {
    console.log(`\n  AgentStamp v2.0.0`);
    console.log(`  Stamp your agent into existence.\n`);
    console.log(`  Server:      http://${config.host}:${config.port}`);
    console.log(`  Health:      http://localhost:${config.port}/health`);
    console.log(`  Landing:     http://localhost:${config.port}/`);
    console.log(`  MCP Live:    http://localhost:${config.port}/mcp`);
    console.log(`  MCP JSON:    http://localhost:${config.port}/.well-known/mcp.json`);
    console.log(`  Agent Card:  http://localhost:${config.port}/.well-known/agent-card.json`);
    console.log(`  x402:        http://localhost:${config.port}/.well-known/x402.json`);
    console.log(`  Smithery:    http://localhost:${config.port}/.well-known/mcp/server-card.json`);
    console.log(`  LLMs:        http://localhost:${config.port}/llms.txt`);
    console.log(`  Wallet:      ${config.walletAddress}`);
    console.log(`  Facilitator: ${config.facilitatorUrl}`);
    console.log(`  Network:     ${config.network}\n`);
  });
})();

// Process-level error handlers — prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception — shutting down gracefully:', err);
  // Give in-flight requests 5 seconds to complete, then exit
  setTimeout(() => process.exit(1), 5000);
});
