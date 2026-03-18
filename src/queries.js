const { getDb, cleanupExpired } = require('./database');
const { computeReputation } = require('./reputation');

/**
 * Shared query functions used by both REST routes and MCP tools.
 * Ensures consistent data access and parsing across protocols.
 */

function parseAgent(agent) {
  if (!agent) return null;
  return {
    ...agent,
    capabilities: JSON.parse(agent.capabilities || '[]'),
    protocols: JSON.parse(agent.protocols || '[]'),
    metadata: JSON.parse(agent.metadata || '{}'),
  };
}

function searchAgents({ q, category, limit = 20, offset = 0 } = {}) {
  cleanupExpired();
  const db = getDb();
  const params = [];
  let sql = "SELECT * FROM agents WHERE status = 'active'";

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
  params.push(Math.min(limit, 100), offset);

  return db.prepare(sql).all(...params).map(parseAgent);
}

function browseAgents({ category, sort = 'endorsements', limit = 20, offset = 0 } = {}) {
  cleanupExpired();
  const db = getDb();
  const params = [];
  let sql = "SELECT * FROM agents WHERE status = 'active'";

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  const sortMap = {
    endorsements: 'endorsement_count DESC',
    newest: 'registered_at DESC',
    name: 'name ASC',
    reputation: 'endorsement_count DESC', // fallback — true reputation sort done in-memory
  };
  sql += ` ORDER BY ${sortMap[sort] || sortMap.endorsements} LIMIT ? OFFSET ?`;
  params.push(Math.min(limit, 100), offset);

  const agents = db.prepare(sql).all(...params).map(parseAgent);

  // If sort by reputation, compute and re-sort
  if (sort === 'reputation') {
    return agents
      .map(a => ({ ...a, reputation: computeReputation(a.id) }))
      .sort((a, b) => (b.reputation?.score || 0) - (a.reputation?.score || 0));
  }

  return agents;
}

function getAgentById(agentId) {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return null;

  const parsed = parseAgent(agent);
  const endorsements = db.prepare(
    'SELECT endorser_wallet, message, created_at FROM endorsements WHERE agent_id = ? ORDER BY created_at DESC'
  ).all(agentId);
  const reputation = computeReputation(agentId);

  return { ...parsed, endorsements, reputation };
}

function getLeaderboard() {
  cleanupExpired();
  const db = getDb();

  const topEndorsed = db.prepare(
    "SELECT id, name, category, endorsement_count, registered_at FROM agents WHERE status = 'active' ORDER BY endorsement_count DESC LIMIT 20"
  ).all();

  // Augment with reputation scores
  const withReputation = topEndorsed.map(a => {
    const rep = computeReputation(a.id);
    return { ...a, reputation_score: rep?.score || 0, reputation_label: rep?.label || 'new' };
  });

  const newest = db.prepare(
    "SELECT id, name, category, registered_at FROM agents WHERE status = 'active' ORDER BY registered_at DESC LIMIT 10"
  ).all();

  const categories = db.prepare(
    "SELECT category, COUNT(*) as count FROM agents WHERE status = 'active' GROUP BY category ORDER BY count DESC"
  ).all();

  return { top_endorsed: withReputation, newest, categories };
}

function browseWishes({ category, sort = 'newest', limit = 20, offset = 0 } = {}) {
  const db = getDb();
  const params = [];
  let sql = 'SELECT * FROM wishes WHERE 1=1';

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  const sortMap = {
    newest: 'created_at DESC',
    most_granted: 'grant_count DESC',
    oldest: 'created_at ASC',
  };
  sql += ` ORDER BY ${sortMap[sort] || sortMap.newest} LIMIT ? OFFSET ?`;
  params.push(Math.min(limit, 100), offset);

  return db.prepare(sql).all(...params);
}

function getTrending() {
  const db = getDb();
  const topCategories = db.prepare(
    'SELECT category, COUNT(*) as count FROM wishes GROUP BY category ORDER BY count DESC'
  ).all();
  const thisWeek = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now', '-7 days')"
  ).get().count;
  const today = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now')"
  ).get().count;

  return { top_categories: topCategories, wishes_today: today, wishes_this_week: thisWeek };
}

module.exports = {
  searchAgents,
  browseAgents,
  getAgentById,
  getLeaderboard,
  browseWishes,
  getTrending,
  parseAgent,
};
