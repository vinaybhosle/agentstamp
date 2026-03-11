const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db;

function initialize() {
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS stamps (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'bronze',
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      certificate TEXT NOT NULL,
      signature TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_stamps_wallet ON stamps(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_stamps_expires ON stamps(expires_at);

    CREATE TABLE IF NOT EXISTS agents (
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stamp_id) REFERENCES stamps(id)
    );

    CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_agents_endorsements ON agents(endorsement_count DESC);

    CREATE TABLE IF NOT EXISTS endorsements (
      id TEXT PRIMARY KEY,
      endorser_wallet TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      UNIQUE(endorser_wallet, agent_id)
    );

    CREATE TABLE IF NOT EXISTS wishes (
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

    CREATE INDEX IF NOT EXISTS idx_wishes_category ON wishes(category);
    CREATE INDEX IF NOT EXISTS idx_wishes_granted ON wishes(granted);
    CREATE INDEX IF NOT EXISTS idx_wishes_wallet ON wishes(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_wishes_created ON wishes(created_at DESC);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      action TEXT NOT NULL,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_transactions_action ON transactions(action);
  `);

  console.log('Database initialized');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return db;
}

function cleanupExpired() {
  const now = new Date().toISOString();
  const d = getDb();
  d.prepare("UPDATE agents SET status = 'expired' WHERE expires_at < ? AND status = 'active'").run(now);
  d.prepare("UPDATE stamps SET revoked = 1 WHERE expires_at < ? AND revoked = 0").run(now);
}

module.exports = { initialize, getDb, cleanupExpired };
