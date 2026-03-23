const express = require('express');
const router = express.Router();
const { getDb, cleanupExpired, resolvePrimaryWallet } = require('../database');
const { generateAgentId, generateEndorsementId, generateTransactionId } = require('../utils/generateId');
const { validateAgentRegister, validateWalletAddress, sanitize, validateUrl } = require('../utils/validators');
const { computeReputation } = require('../reputation');
const { appendEvent } = require('../eventLog');
const { requireSignature } = require('../middleware/walletSignature');

// POST /api/v1/registry/register/free — Free 30-day agent registration
router.post('/register/free', requireSignature({ required: true, action: 'register' }), (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (!walletAddress || walletAddress === '0x0000000000000000000000000000000000000000') {
      return res.status(400).json({ success: false, error: 'wallet_address is required for free registration' });
    }

    const name = sanitize(req.body.name || '');
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (name.length > 100) return res.status(400).json({ success: false, error: 'name must be 100 characters or less' });

    const description = sanitize(req.body.description || '');
    if (!description) return res.status(400).json({ success: false, error: 'description is required' });
    if (description.length > 1000) return res.status(400).json({ success: false, error: 'description must be 1000 characters or less' });

    const AGENT_CATEGORIES = ['data', 'trading', 'research', 'creative', 'infrastructure', 'other'];
    const category = req.body.category || 'other';
    if (!AGENT_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `category must be one of: ${AGENT_CATEGORIES.join(', ')}` });
    }

    let capabilities = Array.isArray(req.body.capabilities)
      ? req.body.capabilities.filter(c => typeof c === 'string').slice(0, 3).map(c => sanitize(c).slice(0, 100))
      : [];

    // Validate endpoint_url — HTTPS only (same as paid registration)
    const endpointUrl = validateUrl(sanitize(req.body.endpoint_url || ''));

    const db = getDb();

    // Resolve to primary wallet for cooldown checks (prevents bypass via linked wallets)
    const resolvedRegWallet = resolvePrimaryWallet(walletAddress);

    // Rate limit: 1 free registration per wallet per 30 days (checked against primary)
    const cooldown = db.prepare('SELECT last_free_registration FROM free_registration_cooldown WHERE wallet_address = ?').get(resolvedRegWallet);
    if (cooldown) {
      const lastReg = new Date(cooldown.last_free_registration);
      const daysSince = (Date.now() - lastReg.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        const nextAvailable = new Date(lastReg.getTime() + 30 * 24 * 60 * 60 * 1000);
        return res.status(429).json({
          success: false,
          error: 'Free registration cooldown active. One free registration per wallet per 30 days.',
          next_available: nextAvailable.toISOString(),
        });
      }
    }

    const agentId = generateAgentId();
    const registeredAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO agents (id, wallet_address, name, description, category, capabilities, protocols, endpoint_url, stamp_id, registered_at, last_heartbeat, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agentId, walletAddress, name, description, category, JSON.stringify(capabilities), JSON.stringify([]), endpointUrl, null, registeredAt, registeredAt, expiresAt, JSON.stringify({ plan: 'free' }));

    // Write cooldown under both the resolved primary AND the actual wallet
    db.prepare(`
      INSERT OR REPLACE INTO free_registration_cooldown (wallet_address, last_free_registration)
      VALUES (?, ?)
    `).run(resolvedRegWallet, registeredAt);
    if (resolvedRegWallet !== walletAddress) {
      db.prepare(`
        INSERT OR REPLACE INTO free_registration_cooldown (wallet_address, last_free_registration)
        VALUES (?, ?)
      `).run(walletAddress, registeredAt);
    }

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/registry/register/free', walletAddress, '0', 'free_register', agentId);

    appendEvent('agent_registered', { agent_id: agentId, wallet_address: walletAddress, name });

    try { require('../webhookDispatcher').dispatch(walletAddress, 'agent_registered', { agent_id: agentId, name, plan: 'free' }); } catch (e) { /* best-effort */ }

    res.status(201).json({
      success: true,
      agent: {
        id: agentId,
        name,
        registered_at: registeredAt,
        expires_at: expiresAt,
        profile_url: `/api/v1/registry/agent/${agentId}`,
        plan: 'free',
      },
      upgrade_info: {
        message: 'Upgrade to paid registration for unlimited capabilities and custom metadata.',
        price: '$0.01',
        endpoint: '/api/v1/registry/register',
      },
    });
  } catch (err) {
    console.error('Free registration error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/registry/register
router.post('/register', requireSignature({ required: true, action: 'register' }), (req, res) => {
  try {
    const validation = validateAgentRegister(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    const { name, description, category, capabilities, protocols, endpoint_url, stamp_id, metadata } = validation.data;

    if (stamp_id) {
      const db = getDb();
      const stamp = db.prepare('SELECT id FROM stamps WHERE id = ? AND revoked = 0').get(stamp_id);
      if (!stamp) {
        return res.status(400).json({ success: false, error: 'Invalid or revoked stamp_id' });
      }
    }

    const agentId = generateAgentId();
    const registeredAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const db = getDb();
    db.prepare(`
      INSERT INTO agents (id, wallet_address, name, description, category, capabilities, protocols, endpoint_url, stamp_id, registered_at, last_heartbeat, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agentId, walletAddress, name, description, category, JSON.stringify(capabilities), JSON.stringify(protocols), endpoint_url, stamp_id, registeredAt, registeredAt, expiresAt, JSON.stringify(metadata));

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/registry/register', walletAddress, '$0.01', 'agent_register', agentId);

    appendEvent('agent_registered', { agent_id: agentId, wallet_address: walletAddress, name });

    try { require('../webhookDispatcher').dispatch(walletAddress, 'agent_registered', { agent_id: agentId, name }); } catch (e) { /* best-effort */ }

    res.status(201).json({
      success: true,
      agent: {
        id: agentId,
        name,
        registered_at: registeredAt,
        expires_at: expiresAt,
        profile_url: `/api/v1/registry/agent/${agentId}`,
      },
    });
  } catch (err) {
    console.error('Registry register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/v1/registry/update/:agentId
router.put('/update/:agentId', requireSignature({ required: true, action: 'update' }), (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (!walletAddress) {
      return res.status(401).json({ success: false, error: 'Wallet address required to update an agent' });
    }
    // Accept any linked wallet as owner
    const resolvedCaller = resolvePrimaryWallet(walletAddress);
    const resolvedOwner = resolvePrimaryWallet(agent.wallet_address);
    if (resolvedCaller !== resolvedOwner) {
      return res.status(403).json({ success: false, error: 'Only the registrant wallet (or a linked wallet) can update this agent' });
    }

    const updates = {};
    if (req.body.name) updates.name = sanitize(req.body.name).slice(0, 100);
    if (req.body.description) updates.description = sanitize(req.body.description).slice(0, 1000);
    if (req.body.category) {
      const AGENT_CATEGORIES = ['data', 'trading', 'research', 'creative', 'infrastructure', 'other'];
      if (!AGENT_CATEGORIES.includes(req.body.category)) {
        return res.status(400).json({ success: false, error: `category must be one of: ${AGENT_CATEGORIES.join(', ')}` });
      }
      updates.category = req.body.category;
    }
    if (req.body.capabilities) updates.capabilities = JSON.stringify(req.body.capabilities);
    if (req.body.protocols) updates.protocols = JSON.stringify(req.body.protocols);
    if (req.body.endpoint_url) updates.endpoint_url = validateUrl(sanitize(req.body.endpoint_url));
    if (req.body.metadata) updates.metadata = JSON.stringify(req.body.metadata);

    // Strict allowlist to prevent SQL injection via dynamic column names
    const ALLOWED_UPDATE_COLS = new Set(['name', 'description', 'category', 'capabilities', 'protocols', 'endpoint_url', 'metadata']);
    const safeKeys = Object.keys(updates).filter(k => ALLOWED_UPDATE_COLS.has(k));
    const setClauses = safeKeys.map(k => `${k} = ?`).join(', ');
    if (setClauses) {
      const safeValues = safeKeys.map(k => updates[k]);
      db.prepare(`UPDATE agents SET ${setClauses} WHERE id = ?`).run(...safeValues, req.params.agentId);
    }

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/registry/update', walletAddress || agent.wallet_address, '$0.005', 'agent_update', req.params.agentId);

    res.json({ success: true, message: 'Agent updated' });
  } catch (err) {
    console.error('Registry update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/registry/endorse/:agentId
router.post('/endorse/:agentId', requireSignature({ required: true, action: 'endorse' }), (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare("SELECT * FROM agents WHERE id = ? AND status = 'active'").get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Active agent not found' });
    }

    const endorserWallet = req.headers['x-wallet-address'] || req.body.wallet_address;

    // Validate endorser wallet format
    const walletCheck = validateWalletAddress(endorserWallet);
    if (!walletCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid endorser wallet address' });
    }

    const existing = db.prepare('SELECT id FROM endorsements WHERE endorser_wallet = ? AND agent_id = ?').get(endorserWallet, req.params.agentId);
    if (existing) {
      return res.status(409).json({ success: false, error: 'You have already endorsed this agent' });
    }

    const endorsementId = generateEndorsementId();
    const message = sanitize(req.body.message || '');

    db.prepare('INSERT INTO endorsements (id, endorser_wallet, agent_id, message) VALUES (?, ?, ?, ?)').run(endorsementId, endorserWallet, req.params.agentId, message);
    db.prepare('UPDATE agents SET endorsement_count = endorsement_count + 1 WHERE id = ?').run(req.params.agentId);

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/registry/endorse', endorserWallet, '$0.005', 'agent_endorse', req.params.agentId);

    appendEvent('endorsement', { agent_id: req.params.agentId, endorser_wallet: endorserWallet });

    try {
      const { checkAndDispatchReputationChange } = require('../reputationMonitor');
      checkAndDispatchReputationChange(req.params.agentId);
    } catch (e) { /* best-effort */ }

    try { require('../webhookDispatcher').dispatch(agent.wallet_address, 'endorsement_received', { agent_id: req.params.agentId, endorser: endorserWallet }); } catch (e) { /* best-effort */ }

    res.status(201).json({ success: true, endorsement_id: endorsementId });
  } catch (err) {
    console.error('Registry endorse error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/registry/search
router.get('/search', (req, res) => {
  try {
    const db = getDb();
    const q = sanitize(req.query.q || '');
    const category = req.query.category;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = "SELECT * FROM agents WHERE status = 'active'";
    const params = [];

    if (q) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR capabilities LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY endorsement_count DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const agents = db.prepare(sql).all(...params);
    const parsed = agents.map(a => ({
      ...a,
      capabilities: JSON.parse(a.capabilities || '[]'),
      protocols: JSON.parse(a.protocols || '[]'),
      metadata: JSON.parse(a.metadata || '{}'),
    }));

    res.json({ success: true, agents: parsed, limit, offset });
  } catch (err) {
    console.error('Registry search error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/registry/browse
router.get('/browse', (req, res) => {
  try {
    const db = getDb();
    const category = req.query.category;
    const sort = req.query.sort || 'endorsements';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = "SELECT * FROM agents WHERE status = 'active'";
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    const sortMap = {
      endorsements: 'endorsement_count DESC',
      newest: 'registered_at DESC',
      name: 'name ASC',
    };
    sql += ` ORDER BY ${sortMap[sort] || sortMap.endorsements} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const agents = db.prepare(sql).all(...params);
    const parsed = agents.map(a => ({
      ...a,
      capabilities: JSON.parse(a.capabilities || '[]'),
      protocols: JSON.parse(a.protocols || '[]'),
      metadata: JSON.parse(a.metadata || '{}'),
    }));

    res.json({ success: true, agents: parsed, limit, offset });
  } catch (err) {
    console.error('Registry browse error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/registry/agent/:agentId
router.get('/agent/:agentId', (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const endorsements = db.prepare('SELECT endorser_wallet, message, created_at FROM endorsements WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100').all(req.params.agentId);

    const reputation = computeReputation(req.params.agentId);

    res.json({
      success: true,
      agent: {
        ...agent,
        capabilities: JSON.parse(agent.capabilities || '[]'),
        protocols: JSON.parse(agent.protocols || '[]'),
        metadata: JSON.parse(agent.metadata || '{}'),
        endorsements,
        reputation: reputation ? {
          score: reputation.score,
          label: reputation.label,
        } : null,
      },
    });
  } catch (err) {
    console.error('Registry agent error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Leaderboard TTL cache (60s) ─────────────────────────────────────────────
let _leaderboardCache = { data: null, expiresAt: 0, key: '' };
const LEADERBOARD_TTL_MS = 60_000;

// GET /api/v1/registry/leaderboard/live — Enhanced leaderboard with filters, network stats, trending
router.get('/leaderboard/live', (req, res) => {
  try {
    const db = getDb();

    // Parse filters
    const category = req.query.category || null;
    const tier = req.query.tier || null;
    const trustedOnly = req.query.trusted_only === 'true';
    const sort = req.query.sort || 'score';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 50);

    // Build a cache key from the query params
    const cacheKey = `${category}|${tier}|${trustedOnly}|${sort}|${limit}`;
    if (_leaderboardCache.data && _leaderboardCache.key === cacheKey && Date.now() < _leaderboardCache.expiresAt) {
      return res.json(_leaderboardCache.data);
    }

    // Get all active agents, optionally filtered by category
    let query = "SELECT * FROM agents WHERE status = 'active'";
    const params = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    const agents = db.prepare(query).all(...params);

    // Build a Map for O(1) agent lookups (fixes N+1 / O(n^2) in trending sort)
    const agentMap = new Map(agents.map(a => [a.id, a]));

    // Compute reputation for each agent
    const enriched = agents.map(agent => {
      const rep = computeReputation(agent.id);

      // Count incoming delegations
      const delegationCount = db.prepare(
        "SELECT COUNT(*) as count FROM trust_delegations WHERE delegatee_wallet = ? AND expires_at > datetime('now')"
      ).get(agent.wallet_address)?.count || 0;

      // Score trend based on last_reputation_score
      let scoreTrend = 'stable';
      if (agent.last_reputation_score !== null && rep) {
        const delta = rep.score - agent.last_reputation_score;
        if (delta >= 3) scoreTrend = 'rising';
        else if (delta <= -3) scoreTrend = 'falling';
      }

      return {
        id: agent.id,
        name: agent.name,
        category: agent.category,
        wallet_address: agent.wallet_address,
        endorsement_count: agent.endorsement_count || 0,
        heartbeat_count: agent.heartbeat_count || 0,
        registered_at: agent.registered_at,
        reputation: rep ? {
          score: rep.score,
          label: rep.label,
          breakdown: rep.breakdown,
        } : { score: 0, label: 'new', breakdown: {} },
        delegations_received: delegationCount,
        score_trend: scoreTrend,
      };
    });

    // Apply tier filter
    const afterTier = tier
      ? enriched.filter(a => a.reputation.label === tier)
      : enriched;

    // Apply trusted-only filter (score >= 10)
    const filtered = trustedOnly
      ? afterTier.filter(a => a.reputation.score >= 10)
      : afterTier;

    // Sort
    const sortFns = {
      score: (a, b) => b.reputation.score - a.reputation.score,
      endorsements: (a, b) => b.endorsement_count - a.endorsement_count,
      uptime: (a, b) => (b.heartbeat_count || 0) - (a.heartbeat_count || 0),
      newest: (a, b) => new Date(b.registered_at) - new Date(a.registered_at),
    };
    const sorted = [...filtered].sort(sortFns[sort] || sortFns.score);

    // Trending: top 5 agents with biggest positive score change (O(1) Map lookup)
    const trending = [...enriched]
      .filter(a => a.score_trend === 'rising')
      .sort((a, b) => {
        const agentA = agentMap.get(a.id);
        const agentB = agentMap.get(b.id);
        const deltaA = a.reputation.score - (agentA?.last_reputation_score || 0);
        const deltaB = b.reputation.score - (agentB?.last_reputation_score || 0);
        return deltaB - deltaA;
      })
      .slice(0, 5);

    // Network stats
    const totalAgents = agents.length;
    const avgScore = totalAgents > 0
      ? Math.round(enriched.reduce((sum, a) => sum + a.reputation.score, 0) / totalAgents)
      : 0;
    const recentHeartbeats = db.prepare(
      "SELECT COUNT(DISTINCT agent_id) as count FROM heartbeat_log WHERE recorded_at > datetime('now', '-1 day')"
    ).get()?.count || 0;
    const activePercent = totalAgents > 0
      ? Math.round((recentHeartbeats / totalAgents) * 100)
      : 0;
    const totalDelegations = db.prepare(
      "SELECT COUNT(*) as count FROM trust_delegations WHERE expires_at > datetime('now')"
    ).get()?.count || 0;
    const totalStamps = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE revoked = 0 AND expires_at > datetime('now')"
    ).get()?.count || 0;

    const responseBody = {
      success: true,
      agents: sorted.slice(0, limit),
      trending,
      network: {
        total_agents: totalAgents,
        average_score: avgScore,
        active_percent: activePercent,
        total_delegations: totalDelegations,
        total_stamps: totalStamps,
      },
    };

    // Cache the response for 60 seconds (frozen to prevent mutation)
    _leaderboardCache = Object.freeze({ data: Object.freeze(responseBody), expiresAt: Date.now() + LEADERBOARD_TTL_MS, key: cacheKey });

    res.json(responseBody);
  } catch (err) {
    console.error('Registry leaderboard/live error:', err);
    res.status(500).json({ success: false, error: 'Failed to load leaderboard' });
  }
});

// GET /api/v1/registry/leaderboard
router.get('/leaderboard', (req, res) => {
  try {
    const db = getDb();

    const topEndorsed = db.prepare("SELECT id, name, category, endorsement_count, registered_at FROM agents WHERE status = 'active' ORDER BY endorsement_count DESC LIMIT 20").all();
    const newest = db.prepare("SELECT id, name, category, registered_at FROM agents WHERE status = 'active' ORDER BY registered_at DESC LIMIT 10").all();
    const categories = db.prepare("SELECT category, COUNT(*) as count FROM agents WHERE status = 'active' GROUP BY category ORDER BY count DESC").all();

    res.json({
      success: true,
      leaderboard: {
        top_endorsed: topEndorsed,
        newest,
        categories,
      },
    });
  } catch (err) {
    console.error('Registry leaderboard error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/registry/heartbeat/:agentId
router.post('/heartbeat/:agentId', requireSignature({ required: true, action: 'heartbeat' }), (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'x-wallet-address header required for heartbeats' });
    }
    const resolvedHBCaller = resolvePrimaryWallet(walletAddress);
    const resolvedHBOwner = resolvePrimaryWallet(agent.wallet_address);
    if (resolvedHBCaller !== resolvedHBOwner) {
      return res.status(403).json({ success: false, error: 'Only the registrant wallet (or a linked wallet) can send heartbeats' });
    }

    // Per-agent heartbeat cooldown: minimum 60 seconds between heartbeats
    const MIN_HEARTBEAT_INTERVAL_MS = 60 * 1000;
    const lastHBTime = agent.last_heartbeat ? new Date(agent.last_heartbeat).getTime() : 0;
    if (Date.now() - lastHBTime < MIN_HEARTBEAT_INTERVAL_MS) {
      return res.status(429).json({ success: false, error: 'Heartbeat too frequent. Minimum 1 minute between heartbeats.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE agents SET last_heartbeat = ?, heartbeat_count = heartbeat_count + 1 WHERE id = ?').run(now, req.params.agentId);
    db.prepare('INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)').run(req.params.agentId, now);

    appendEvent('heartbeat', { agent_id: req.params.agentId });

    try {
      const { checkAndDispatchReputationChange } = require('../reputationMonitor');
      checkAndDispatchReputationChange(req.params.agentId);
    } catch (e) { /* best-effort */ }

    const updated = db.prepare('SELECT heartbeat_count FROM agents WHERE id = ?').get(req.params.agentId);

    // Check stamp expiry for renewal nudge
    const stamp = db.prepare('SELECT * FROM stamps WHERE wallet_address = ? AND revoked = 0 ORDER BY expires_at DESC LIMIT 1').get(agent.wallet_address);
    let renewalInfo = null;
    if (stamp) {
      const hoursUntilExpiry = (new Date(stamp.expires_at).getTime() - Date.now()) / (1000 * 60 * 60);
      renewalInfo = {
        stamp_id: stamp.id,
        stamp_tier: stamp.tier,
        stamp_expires_at: stamp.expires_at,
        hours_until_expiry: Math.round(hoursUntilExpiry),
        needs_renewal: hoursUntilExpiry < 48,
        renew_url: `https://agentstamp.org/api/v1/stamp/mint/${stamp.tier === 'free' ? 'bronze' : stamp.tier}`,
      };
    }

    res.json({ success: true, last_heartbeat: now, heartbeat_count: updated.heartbeat_count, renewal_info: renewalInfo });
  } catch (err) {
    console.error('Registry heartbeat error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/registry/agent/:agentId/reputation
router.get('/agent/:agentId/reputation', (req, res) => {
  try {
    const reputation = computeReputation(req.params.agentId);
    if (!reputation) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    res.json({
      success: true,
      agent_id: req.params.agentId,
      ...reputation,
    });
  } catch (err) {
    console.error('Registry reputation error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
