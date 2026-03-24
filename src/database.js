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

  // Tighten database file permissions (mirror crypto.js key file pattern)
  try {
    const stat = fs.statSync(config.dbPath);
    if (stat.mode & 0o077) { // any group/other permissions
      fs.chmodSync(config.dbPath, 0o600);
      console.log(`Database file permissions tightened to 0600: ${config.dbPath}`);
    }
  } catch (e) {
    console.warn('Could not check/fix database file permissions:', e.message);
  }

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

    CREATE TABLE IF NOT EXISTS heartbeat_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_heartbeat_agent ON heartbeat_log(agent_id);

    CREATE TABLE IF NOT EXISTS free_stamp_cooldown (
      wallet_address TEXT PRIMARY KEY,
      last_free_mint TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS free_registration_cooldown (
      wallet_address TEXT PRIMARY KEY,
      last_free_registration TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(wallet_address, url)
    );

    CREATE INDEX IF NOT EXISTS idx_webhooks_wallet ON webhooks(wallet_address);

    CREATE TABLE IF NOT EXISTS api_hits (
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

    CREATE INDEX IF NOT EXISTS idx_api_hits_created ON api_hits(created_at);
    CREATE INDEX IF NOT EXISTS idx_api_hits_path ON api_hits(path);
    CREATE INDEX IF NOT EXISTS idx_api_hits_ip ON api_hits(ip_hash);

    CREATE TABLE IF NOT EXISTS wallet_links (
      primary_wallet TEXT NOT NULL,
      linked_wallet TEXT NOT NULL UNIQUE,
      chain_hint TEXT,
      linked_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (primary_wallet, linked_wallet)
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_links_primary ON wallet_links(primary_wallet);
    CREATE INDEX IF NOT EXISTS idx_wallet_links_linked ON wallet_links(linked_wallet);

    CREATE TABLE IF NOT EXISTS stamp_events (
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

    CREATE INDEX IF NOT EXISTS idx_stamp_events_wallet ON stamp_events(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_stamp_events_stamp ON stamp_events(stamp_id);
    CREATE INDEX IF NOT EXISTS idx_stamp_events_outcome ON stamp_events(outcome);
    CREATE INDEX IF NOT EXISTS idx_stamp_events_created ON stamp_events(created_at DESC);

    CREATE TABLE IF NOT EXISTS trust_delegations (
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

    CREATE TABLE IF NOT EXISTS event_log (
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

    CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_log_stamp ON event_log(stamp_id);
    CREATE INDEX IF NOT EXISTS idx_event_log_agent ON event_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_event_log_wallet ON event_log(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at DESC);

    CREATE TABLE IF NOT EXISTS blind_tokens (
      token TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      nonce TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_blind_tokens_wallet ON blind_tokens(wallet_address);

    CREATE TABLE IF NOT EXISTS erc8004_links (
      erc8004_agent_id TEXT PRIMARY KEY,
      erc8004_chain TEXT DEFAULT 'base',
      agentstamp_wallet TEXT NOT NULL,
      agentstamp_agent_id TEXT,
      registration_name TEXT,
      registration_uri TEXT,
      linked_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_erc8004_wallet ON erc8004_links(agentstamp_wallet);

    CREATE TABLE IF NOT EXISTS payment_hashes (
      hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payment_hashes_created ON payment_hashes(created_at);
  `);

  // Add heartbeat_count column if it doesn't exist (migration-safe)
  try {
    db.exec('ALTER TABLE agents ADD COLUMN heartbeat_count INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Add tombstone columns for stamp lifecycle closure (migration-safe)
  try {
    db.exec('ALTER TABLE stamps ADD COLUMN outcome TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists — safe to ignore
  }
  try {
    db.exec('ALTER TABLE stamps ADD COLUMN tombstoned_at TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists — safe to ignore
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_stamps_outcome ON stamps(outcome)');

  // Add last_reputation_score column for reputation change detection
  try {
    db.exec('ALTER TABLE agents ADD COLUMN last_reputation_score INTEGER DEFAULT NULL');
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Add wallet_verified column for cryptographic wallet ownership proof
  try {
    db.exec('ALTER TABLE agents ADD COLUMN wallet_verified INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Add human_sponsor column for accountability (who operates this agent)
  try {
    db.exec('ALTER TABLE agents ADD COLUMN human_sponsor TEXT DEFAULT NULL');
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Add AI Act compliance columns
  try {
    db.exec("ALTER TABLE agents ADD COLUMN ai_act_risk_level TEXT DEFAULT NULL");
  } catch (e) { /* exists */ }
  try {
    db.exec("ALTER TABLE agents ADD COLUMN transparency_declaration TEXT DEFAULT NULL");
  } catch (e) { /* exists */ }

  // Add nonce column to blind_tokens for audit trail (migration-safe)
  try {
    db.exec("ALTER TABLE blind_tokens ADD COLUMN nonce TEXT NOT NULL DEFAULT ''");
  } catch (e) {
    // Column already exists — safe to ignore
  }

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return db;
}

/**
 * Resolve a wallet address to its primary wallet.
 * If the wallet is a secondary (linked) wallet, returns the primary.
 * If not linked, returns the input unchanged.
 */
function resolvePrimaryWallet(walletAddress) {
  const d = getDb();
  const link = d.prepare(
    'SELECT primary_wallet FROM wallet_links WHERE linked_wallet = ?'
  ).get(walletAddress);
  return link ? link.primary_wallet : walletAddress;
}

/**
 * Get all wallets linked to a primary wallet.
 * Resolves input first in case it's a secondary wallet.
 */
function getAllLinkedWallets(walletAddress) {
  const d = getDb();
  const primary = resolvePrimaryWallet(walletAddress);
  const links = d.prepare(
    'SELECT linked_wallet, chain_hint, linked_at FROM wallet_links WHERE primary_wallet = ?'
  ).all(primary);
  return {
    primary,
    linked: links,
    all: [primary, ...links.map(l => l.linked_wallet)],
  };
}

function cleanupExpired() {
  const now = new Date().toISOString();
  const d = getDb();

  // Dispatch stamp_expiring webhooks for stamps expiring within 24 hours
  try {
    const { dispatch } = require('./webhookDispatcher');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const expiringSoon = d.prepare(
      "SELECT * FROM stamps WHERE expires_at > ? AND expires_at <= ? AND revoked = 0"
    ).all(now, tomorrow);
    for (const stamp of expiringSoon) {
      dispatch(stamp.wallet_address, 'stamp_expiring', {
        stamp_id: stamp.id,
        tier: stamp.tier,
        expires_at: stamp.expires_at,
        renew_url: `https://agentstamp.org/api/v1/stamp/mint/${stamp.tier}`,
      });
    }
  } catch (e) { /* webhook dispatch is best-effort */ }

  // Query rows that will be affected BEFORE the updates
  const expiringStamps = d.prepare(
    'SELECT id, wallet_address FROM stamps WHERE expires_at < ? AND revoked = 0'
  ).all(now);
  const expiringAgents = d.prepare(
    "SELECT id, wallet_address FROM agents WHERE expires_at < ? AND status = 'active'"
  ).all(now);

  d.prepare("UPDATE agents SET status = 'expired' WHERE expires_at < ? AND status = 'active'").run(now);

  // Tombstone expired stamps without an existing outcome as 'timeout'
  d.prepare(
    "UPDATE stamps SET outcome = 'timeout', tombstoned_at = datetime('now'), revoked = 1 WHERE expires_at < ? AND revoked = 0 AND outcome IS NULL"
  ).run(now);

  // Revoke expired stamps that already have an outcome (preserve their outcome)
  d.prepare(
    "UPDATE stamps SET revoked = 1 WHERE expires_at < ? AND revoked = 0 AND outcome IS NOT NULL"
  ).run(now);

  // Log expiration events (lazy require to avoid circular dependency)
  const { appendEvent } = require('./eventLog');
  for (const s of expiringStamps) {
    appendEvent('stamp_revoked', { stamp_id: s.id, wallet_address: s.wallet_address });
  }
  for (const a of expiringAgents) {
    appendEvent('agent_expired', { agent_id: a.id, wallet_address: a.wallet_address });
    try { require('./webhookDispatcher').dispatch(a.wallet_address, 'agent_expired', { agent_id: a.id }); } catch (e) { /* best-effort */ }
  }

  // Reputation monitoring is handled by heartbeat/endorsement handlers — not here.

  // Prune old heartbeat log entries (keep 90 days)
  try {
    const pruned = db.prepare("DELETE FROM heartbeat_log WHERE recorded_at < datetime('now', '-90 days')").run();
    if (pruned.changes > 0) {
      console.log(`Pruned ${pruned.changes} heartbeat_log entries older than 90 days`);
    }
  } catch (e) { /* best-effort */ }

  // Prune old blind tokens (keep 30 days)
  try {
    const prunedTokens = db.prepare("DELETE FROM blind_tokens WHERE created_at < datetime('now', '-30 days')").run();
    if (prunedTokens.changes > 0) {
      console.log(`Pruned ${prunedTokens.changes} expired blind tokens`);
    }
  } catch (e) { /* best-effort */ }
}

module.exports = { initialize, getDb, cleanupExpired, resolvePrimaryWallet, getAllLinkedWallets };
