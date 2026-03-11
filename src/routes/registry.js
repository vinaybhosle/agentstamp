const express = require('express');
const router = express.Router();
const { getDb, cleanupExpired } = require('../database');
const { generateAgentId, generateEndorsementId, generateTransactionId } = require('../utils/generateId');
const { validateAgentRegister, sanitize } = require('../utils/validators');

// POST /api/v1/registry/register
router.post('/register', (req, res) => {
  try {
    const validation = validateAgentRegister(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address || '0x0000000000000000000000000000000000000000';
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
router.put('/update/:agentId', (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (walletAddress && walletAddress !== agent.wallet_address) {
      return res.status(403).json({ success: false, error: 'Only the registrant wallet can update this agent' });
    }

    const updates = {};
    if (req.body.name) updates.name = sanitize(req.body.name).slice(0, 100);
    if (req.body.description) updates.description = sanitize(req.body.description).slice(0, 1000);
    if (req.body.category) updates.category = req.body.category;
    if (req.body.capabilities) updates.capabilities = JSON.stringify(req.body.capabilities);
    if (req.body.protocols) updates.protocols = JSON.stringify(req.body.protocols);
    if (req.body.endpoint_url) updates.endpoint_url = sanitize(req.body.endpoint_url);
    if (req.body.metadata) updates.metadata = JSON.stringify(req.body.metadata);

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    if (setClauses) {
      db.prepare(`UPDATE agents SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.agentId);
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
router.post('/endorse/:agentId', (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare("SELECT * FROM agents WHERE id = ? AND status = 'active'").get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Active agent not found' });
    }

    const endorserWallet = req.headers['x-wallet-address'] || req.body.wallet_address || '0x0000000000000000000000000000000000000000';

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

    res.status(201).json({ success: true, endorsement_id: endorsementId });
  } catch (err) {
    console.error('Registry endorse error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/registry/search
router.get('/search', (req, res) => {
  try {
    cleanupExpired();
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
    cleanupExpired();
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

    const endorsements = db.prepare('SELECT endorser_wallet, message, created_at FROM endorsements WHERE agent_id = ? ORDER BY created_at DESC').all(req.params.agentId);

    res.json({
      success: true,
      agent: {
        ...agent,
        capabilities: JSON.parse(agent.capabilities || '[]'),
        protocols: JSON.parse(agent.protocols || '[]'),
        metadata: JSON.parse(agent.metadata || '{}'),
        endorsements,
      },
    });
  } catch (err) {
    console.error('Registry agent error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/registry/leaderboard
router.get('/leaderboard', (req, res) => {
  try {
    cleanupExpired();
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
router.post('/heartbeat/:agentId', (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (walletAddress && walletAddress !== agent.wallet_address) {
      return res.status(403).json({ success: false, error: 'Only the registrant wallet can send heartbeats' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE agents SET last_heartbeat = ? WHERE id = ?').run(now, req.params.agentId);

    res.json({ success: true, last_heartbeat: now });
  } catch (err) {
    console.error('Registry heartbeat error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
