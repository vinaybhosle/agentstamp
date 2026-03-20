const { getDb } = require('./database');
const { generateEventId } = require('./utils/generateId');

const EVENT_TYPES = [
  'stamp_minted', 'stamp_tombstoned', 'stamp_revoked',
  'agent_registered', 'agent_expired',
  'heartbeat', 'endorsement',
  'wish_created', 'wish_granted',
  'stamp_event', 'wallet_linked',
  'trust_decayed', 'reputation_changed',
  'trust_delegated', 'trust_revoked',
  'blind_verified',
];

const EXECUTION_EVENTS = [
  'stamp_minted', 'agent_registered', 'heartbeat',
  'endorsement', 'wish_granted', 'stamp_event',
];

function appendEvent(eventType, data = {}) {
  const db = getDb();
  // Lazy require to avoid circular dependency issues
  const { computeEventHash, getChainHead } = require('./hashChain');
  const { signCertificate } = require('./crypto');

  const id = generateEventId();
  const now = new Date().toISOString();
  const payload = JSON.stringify(data);

  // Use transaction for atomicity (getChainHead + INSERT must be serialized)
  const insertEvent = db.transaction(() => {
    const prevHash = getChainHead(db);
    const eventHash = computeEventHash(prevHash, eventType, payload, now);
    const signature = signCertificate({ hash: eventHash });

    db.prepare(`
      INSERT INTO event_log (id, event_type, stamp_id, agent_id, wallet_address, payload, prev_hash, event_hash, signature, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, eventType,
      data.stamp_id || null, data.agent_id || null, data.wallet_address || null,
      payload, prevHash, eventHash, signature, now
    );

    return { id, event_type: eventType, event_hash: eventHash, created_at: now };
  });

  return insertEvent();
}

function getLastEvent() {
  const db = getDb();
  return db.prepare('SELECT * FROM event_log ORDER BY rowid DESC LIMIT 1').get() || null;
}

function queryEvents(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.event_type) {
    conditions.push('event_type = ?');
    params.push(filters.event_type);
  }
  if (filters.stamp_id) {
    conditions.push('stamp_id = ?');
    params.push(filters.stamp_id);
  }
  if (filters.agent_id) {
    conditions.push('agent_id = ?');
    params.push(filters.agent_id);
  }
  if (filters.wallet_address) {
    conditions.push('wallet_address = ?');
    params.push(filters.wallet_address);
  }
  if (filters.since) {
    conditions.push('created_at >= ?');
    params.push(filters.since);
  }
  if (filters.until) {
    conditions.push('created_at <= ?');
    params.push(filters.until);
  }
  if (filters.event_types) {
    const placeholders = filters.event_types.map(() => '?').join(',');
    conditions.push(`event_type IN (${placeholders})`);
    params.push(...filters.event_types);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;

  const total = db.prepare(
    `SELECT COUNT(*) as count FROM event_log ${where}`
  ).get(...params).count;

  const events = db.prepare(
    `SELECT * FROM event_log ${where} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { events, total, limit, offset };
}

module.exports = { appendEvent, getLastEvent, queryEvents, EVENT_TYPES, EXECUTION_EVENTS };
