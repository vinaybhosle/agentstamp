const Database = require('better-sqlite3');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = OFF');

  db.exec(`
    CREATE TABLE stamps (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'bronze',
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      certificate TEXT NOT NULL,
      signature TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      outcome TEXT DEFAULT NULL,
      tombstoned_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      capabilities TEXT,
      protocols TEXT,
      endpoint_url TEXT,
      stamp_id TEXT,
      endorsement_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      registered_at TEXT NOT NULL,
      last_heartbeat TEXT,
      expires_at TEXT NOT NULL,
      metadata TEXT,
      heartbeat_count INTEGER DEFAULT 0,
      last_reputation_score INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stamp_id) REFERENCES stamps(id)
    );

    CREATE TABLE endorsements (
      id TEXT PRIMARY KEY,
      endorser_wallet TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      UNIQUE(endorser_wallet, agent_id)
    );

    CREATE TABLE wishes (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      agent_id TEXT,
      wish_text TEXT NOT NULL,
      category TEXT,
      granted INTEGER NOT NULL DEFAULT 0,
      granted_by TEXT,
      granted_at TEXT,
      grant_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      action TEXT NOT NULL,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE heartbeat_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE free_stamp_cooldown (
      wallet_address TEXT PRIMARY KEY,
      last_free_mint TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE free_registration_cooldown (
      wallet_address TEXT PRIMARY KEY,
      last_free_registration TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE webhooks (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(wallet_address, url)
    );

    CREATE TABLE api_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      ip_hash TEXT,
      user_agent TEXT,
      wallet_address TEXT,
      is_bot INTEGER DEFAULT 0,
      referrer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE stamp_events (
      id TEXT PRIMARY KEY,
      stamp_id TEXT,
      agent_id TEXT,
      wallet_address TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      gate_reason TEXT,
      endpoint TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE trust_delegations (
      id TEXT PRIMARY KEY,
      delegator_wallet TEXT NOT NULL,
      delegatee_wallet TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      reason TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(delegator_wallet, delegatee_wallet)
    );
    CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON trust_delegations(delegator_wallet);
    CREATE INDEX IF NOT EXISTS idx_delegations_delegatee ON trust_delegations(delegatee_wallet);
    CREATE INDEX IF NOT EXISTS idx_delegations_expires ON trust_delegations(expires_at);

    CREATE TABLE event_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      stamp_id TEXT,
      agent_id TEXT,
      wallet_address TEXT,
      payload TEXT NOT NULL,
      prev_hash TEXT,
      event_hash TEXT,
      signature TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE wallet_links (
      primary_wallet TEXT NOT NULL,
      linked_wallet TEXT NOT NULL UNIQUE,
      chain_hint TEXT,
      linked_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (primary_wallet, linked_wallet)
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_links_primary ON wallet_links(primary_wallet);
    CREATE INDEX IF NOT EXISTS idx_wallet_links_linked ON wallet_links(linked_wallet);

    CREATE TABLE blind_tokens (
      token TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_blind_tokens_wallet ON blind_tokens(wallet_address);
  `);

  return db;
}

module.exports = { createTestDb };
