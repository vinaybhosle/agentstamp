const crypto = require('crypto');

const GENESIS_HASH = '0';

function computeEventHash(prevHash, eventType, payload, timestamp) {
  const data = `${prevHash}|${eventType}|${payload}|${timestamp}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getChainHead(db) {
  const last = db.prepare(
    'SELECT event_hash FROM event_log WHERE event_hash IS NOT NULL ORDER BY rowid DESC LIMIT 1'
  ).get();
  return last ? last.event_hash : GENESIS_HASH;
}

function verifyChain(db, options = {}) {
  const limit = options.limit || 10000;

  const events = db.prepare(
    'SELECT id, event_type, payload, prev_hash, event_hash, signature, created_at FROM event_log WHERE event_hash IS NOT NULL ORDER BY rowid ASC LIMIT ?'
  ).all(limit);

  if (events.length === 0) {
    return { valid: true, length: 0, gaps: [], tampered_events: [] };
  }

  const gaps = [];
  const tampered_events = [];
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.prev_hash !== expectedPrevHash) {
      gaps.push({
        index: i,
        event_id: event.id,
        expected: expectedPrevHash,
        actual: event.prev_hash,
      });
    }

    const recomputed = computeEventHash(
      event.prev_hash, event.event_type, event.payload, event.created_at
    );
    if (recomputed !== event.event_hash) {
      tampered_events.push({
        index: i,
        event_id: event.id,
        stored: event.event_hash,
        recomputed,
      });
    }

    expectedPrevHash = event.event_hash;
  }

  return {
    valid: gaps.length === 0 && tampered_events.length === 0,
    length: events.length,
    head: events[events.length - 1].event_hash,
    gaps,
    tampered_events,
  };
}

module.exports = { computeEventHash, getChainHead, verifyChain, GENESIS_HASH };
