const { createTestDb } = require('./helpers');
const {
  runStampsChecks,
  runAgentsChecks,
  runEndorsementsChecks,
  runWishesChecks,
  runTransactionsChecks,
  runWebhooksChecks,
  runHeartbeatChecks,
  runApiHitsChecks,
  runCrossTableChecks,
  runFullReport,
} = require('../src/dataQualityChecks');

const GOOD_WALLET = '0x' + 'a'.repeat(40);
const GOOD_WALLET_2 = '0x' + 'b'.repeat(40);
const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000 * 30).toISOString();

// ─── Stamps Checks ──────────────────────────────────────────────────────────

describe('runStampsChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings for valid stamps', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('stmp_abc123', GOOD_WALLET, 'gold', NOW, FUTURE, '{"v":1}', 'sig');
    expect(runStampsChecks(db)).toEqual([]);
  });

  it('detects invalid_wallet_address', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('stmp_1', 'bad-wallet', 'gold', NOW, FUTURE, '{}', 'sig');
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'invalid_wallet_address')).toBe(true);
  });

  it('detects invalid_tier', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('stmp_2', GOOD_WALLET, 'diamond', NOW, FUTURE, '{}', 'sig');
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'invalid_tier')).toBe(true);
  });

  it('detects expired_not_revoked', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('stmp_3', GOOD_WALLET, 'gold', PAST, PAST, '{}', 'sig', 0);
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'expired_not_revoked')).toBe(true);
  });

  it('detects invalid_certificate_json', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('stmp_4', GOOD_WALLET, 'gold', NOW, FUTURE, 'not-json', 'sig');
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'invalid_certificate_json')).toBe(true);
  });

  it('detects invalid_id_prefix', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('bad_prefix', GOOD_WALLET, 'gold', NOW, FUTURE, '{}', 'sig');
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'invalid_id_prefix')).toBe(true);
  });
});

// ─── Agents Checks ──────────────────────────────────────────────────────────

describe('runAgentsChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  function insertAgent(overrides = {}) {
    const defaults = {
      id: 'agt_test1', wallet_address: GOOD_WALLET, name: 'Test', description: 'desc',
      category: 'data', capabilities: '[]', protocols: '[]', endpoint_url: '',
      stamp_id: null, endorsement_count: 0, status: 'active',
      registered_at: NOW, last_heartbeat: NOW, expires_at: FUTURE, metadata: '{}',
    };
    const row = { ...defaults, ...overrides };
    db.prepare(`INSERT INTO agents (id, wallet_address, name, description, category, capabilities, protocols,
      endpoint_url, stamp_id, endorsement_count, status, registered_at, last_heartbeat, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      row.id, row.wallet_address, row.name, row.description, row.category,
      row.capabilities, row.protocols, row.endpoint_url, row.stamp_id,
      row.endorsement_count, row.status, row.registered_at, row.last_heartbeat,
      row.expires_at, row.metadata);
  }

  it('returns no findings for valid agents', () => {
    insertAgent();
    expect(runAgentsChecks(db)).toEqual([]);
  });

  it('detects invalid_wallet_address', () => {
    insertAgent({ wallet_address: 'not-a-wallet' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_wallet_address')).toBe(true);
  });

  it('detects invalid_id_prefix', () => {
    insertAgent({ id: 'bad_id' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_id_prefix')).toBe(true);
  });

  it('detects invalid_category', () => {
    insertAgent({ category: 'hacking' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_category')).toBe(true);
  });

  it('detects invalid_status', () => {
    insertAgent({ status: 'deleted' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_status')).toBe(true);
  });

  it('detects active_but_expired', () => {
    insertAgent({ status: 'active', expires_at: PAST });
    expect(runAgentsChecks(db).some(f => f.check === 'active_but_expired')).toBe(true);
  });

  it('detects orphaned_stamp_id', () => {
    insertAgent({ stamp_id: 'stmp_nonexistent' });
    expect(runAgentsChecks(db).some(f => f.check === 'orphaned_stamp_id')).toBe(true);
  });

  it('detects endorsement_count_mismatch', () => {
    insertAgent({ endorsement_count: 5 }); // no actual endorsements
    expect(runAgentsChecks(db).some(f => f.check === 'endorsement_count_mismatch')).toBe(true);
  });

  it('detects invalid_capabilities_json', () => {
    insertAgent({ capabilities: 'not-json' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_capabilities_json')).toBe(true);
  });

  it('detects invalid_protocols_json', () => {
    insertAgent({ protocols: '{bad' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_protocols_json')).toBe(true);
  });

  it('detects invalid_metadata_json', () => {
    insertAgent({ metadata: 'nope' });
    expect(runAgentsChecks(db).some(f => f.check === 'invalid_metadata_json')).toBe(true);
  });
});

// ─── Endorsements Checks ────────────────────────────────────────────────────

describe('runEndorsementsChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings for valid endorsements', () => {
    // Insert agent first
    db.prepare(`INSERT INTO agents (id, wallet_address, name, registered_at, expires_at)
      VALUES (?, ?, ?, ?, ?)`).run('agt_a1', GOOD_WALLET, 'A', NOW, FUTURE);
    db.prepare(`INSERT INTO endorsements (id, endorser_wallet, agent_id, message)
      VALUES (?, ?, ?, ?)`).run('end_e1', GOOD_WALLET_2, 'agt_a1', 'great');
    expect(runEndorsementsChecks(db)).toEqual([]);
  });

  it('detects invalid_wallet_address', () => {
    db.prepare(`INSERT INTO agents (id, wallet_address, name, registered_at, expires_at)
      VALUES (?, ?, ?, ?, ?)`).run('agt_a1', GOOD_WALLET, 'A', NOW, FUTURE);
    db.prepare(`INSERT INTO endorsements (id, endorser_wallet, agent_id)
      VALUES (?, ?, ?)`).run('end_e2', 'bad', 'agt_a1');
    expect(runEndorsementsChecks(db).some(f => f.check === 'invalid_wallet_address')).toBe(true);
  });

  it('detects orphaned_agent_id', () => {
    db.prepare(`INSERT INTO endorsements (id, endorser_wallet, agent_id)
      VALUES (?, ?, ?)`).run('end_e3', GOOD_WALLET, 'agt_nonexistent');
    expect(runEndorsementsChecks(db).some(f => f.check === 'orphaned_agent_id')).toBe(true);
  });

  it('detects invalid_id_prefix', () => {
    db.prepare(`INSERT INTO agents (id, wallet_address, name, registered_at, expires_at)
      VALUES (?, ?, ?, ?, ?)`).run('agt_a1', GOOD_WALLET, 'A', NOW, FUTURE);
    db.prepare(`INSERT INTO endorsements (id, endorser_wallet, agent_id)
      VALUES (?, ?, ?)`).run('bad_prefix', GOOD_WALLET_2, 'agt_a1');
    expect(runEndorsementsChecks(db).some(f => f.check === 'invalid_id_prefix')).toBe(true);
  });
});

// ─── Wishes Checks ──────────────────────────────────────────────────────────

describe('runWishesChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings for valid wishes', () => {
    db.prepare(`INSERT INTO wishes (id, wallet_address, wish_text, category)
      VALUES (?, ?, ?, ?)`).run('wish_w1', GOOD_WALLET, 'I wish for data', 'data');
    expect(runWishesChecks(db)).toEqual([]);
  });

  it('detects invalid_wallet_address', () => {
    db.prepare(`INSERT INTO wishes (id, wallet_address, wish_text, category)
      VALUES (?, ?, ?, ?)`).run('wish_w2', 'bad', 'wish', 'data');
    expect(runWishesChecks(db).some(f => f.check === 'invalid_wallet_address')).toBe(true);
  });

  it('detects invalid_category', () => {
    db.prepare(`INSERT INTO wishes (id, wallet_address, wish_text, category)
      VALUES (?, ?, ?, ?)`).run('wish_w3', GOOD_WALLET, 'wish', 'hacking');
    expect(runWishesChecks(db).some(f => f.check === 'invalid_category')).toBe(true);
  });

  it('detects granted_without_timestamp', () => {
    db.prepare(`INSERT INTO wishes (id, wallet_address, wish_text, category, granted)
      VALUES (?, ?, ?, ?, ?)`).run('wish_w4', GOOD_WALLET, 'wish', 'data', 1);
    expect(runWishesChecks(db).some(f => f.check === 'granted_without_timestamp')).toBe(true);
  });

  it('detects orphaned_agent_id', () => {
    db.prepare(`INSERT INTO wishes (id, wallet_address, wish_text, category, agent_id)
      VALUES (?, ?, ?, ?, ?)`).run('wish_w5', GOOD_WALLET, 'wish', 'data', 'agt_gone');
    expect(runWishesChecks(db).some(f => f.check === 'orphaned_agent_id')).toBe(true);
  });

  it('detects invalid_id_prefix', () => {
    db.prepare(`INSERT INTO wishes (id, wallet_address, wish_text, category)
      VALUES (?, ?, ?, ?)`).run('bad_id', GOOD_WALLET, 'wish', 'data');
    expect(runWishesChecks(db).some(f => f.check === 'invalid_id_prefix')).toBe(true);
  });
});

// ─── Transactions Checks ────────────────────────────────────────────────────

describe('runTransactionsChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings for valid transactions', () => {
    db.prepare(`INSERT INTO transactions (id, endpoint, wallet_address, amount, action)
      VALUES (?, ?, ?, ?, ?)`).run('txn_t1', '/api/v1/stamp/mint/free', GOOD_WALLET, '0', 'free_mint');
    expect(runTransactionsChecks(db)).toEqual([]);
  });

  it('detects invalid_id_prefix', () => {
    db.prepare(`INSERT INTO transactions (id, endpoint, wallet_address, amount, action)
      VALUES (?, ?, ?, ?, ?)`).run('bad_id', '/ep', GOOD_WALLET, '0', 'free_mint');
    expect(runTransactionsChecks(db).some(f => f.check === 'invalid_id_prefix')).toBe(true);
  });

  it('detects unknown_action', () => {
    db.prepare(`INSERT INTO transactions (id, endpoint, wallet_address, amount, action)
      VALUES (?, ?, ?, ?, ?)`).run('txn_t2', '/ep', GOOD_WALLET, '0', 'hack_the_planet');
    expect(runTransactionsChecks(db).some(f => f.check === 'unknown_action')).toBe(true);
  });
});

// ─── Webhooks Checks ────────────────────────────────────────────────────────

describe('runWebhooksChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings for valid webhooks', () => {
    db.prepare(`INSERT INTO webhooks (id, wallet_address, url, events, secret)
      VALUES (?, ?, ?, ?, ?)`).run('whk_w1', GOOD_WALLET, 'https://example.com/hook', '["stamp_minted"]', 'secret');
    expect(runWebhooksChecks(db)).toEqual([]);
  });

  it('detects invalid_wallet_address', () => {
    db.prepare(`INSERT INTO webhooks (id, wallet_address, url, events, secret)
      VALUES (?, ?, ?, ?, ?)`).run('whk_w2', 'bad', 'https://example.com/hook', '["stamp_minted"]', 's');
    expect(runWebhooksChecks(db).some(f => f.check === 'invalid_wallet_address')).toBe(true);
  });

  it('detects invalid_events_json', () => {
    db.prepare(`INSERT INTO webhooks (id, wallet_address, url, events, secret)
      VALUES (?, ?, ?, ?, ?)`).run('whk_w3', GOOD_WALLET, 'https://example.com', 'not-json', 's');
    expect(runWebhooksChecks(db).some(f => f.check === 'invalid_events_json')).toBe(true);
  });

  it('detects unknown_event_type', () => {
    db.prepare(`INSERT INTO webhooks (id, wallet_address, url, events, secret)
      VALUES (?, ?, ?, ?, ?)`).run('whk_w4', GOOD_WALLET, 'https://example.com', '["fake_event"]', 's');
    expect(runWebhooksChecks(db).some(f => f.check === 'unknown_event_type')).toBe(true);
  });

  it('detects invalid_url', () => {
    db.prepare(`INSERT INTO webhooks (id, wallet_address, url, events, secret)
      VALUES (?, ?, ?, ?, ?)`).run('whk_w5', GOOD_WALLET, 'not a url', '["stamp_minted"]', 's');
    expect(runWebhooksChecks(db).some(f => f.check === 'invalid_url')).toBe(true);
  });
});

// ─── Heartbeat Checks ───────────────────────────────────────────────────────

describe('runHeartbeatChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings when heartbeat counts are normal', () => {
    db.prepare(`INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)`).run('agt_a1', NOW);
    expect(runHeartbeatChecks(db)).toEqual([]);
  });

  it('detects excessive_heartbeats', () => {
    // Insert 10001 rows via a loop in SQL
    const insert = db.prepare('INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)');
    const batch = db.transaction(() => {
      for (let i = 0; i < 10001; i++) {
        insert.run('agt_heavy', NOW);
      }
    });
    batch();
    const findings = runHeartbeatChecks(db);
    expect(findings.some(f => f.check === 'excessive_heartbeats')).toBe(true);
  });
});

// ─── API Hits Checks ────────────────────────────────────────────────────────

describe('runApiHitsChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns no findings for small recent table', () => {
    db.prepare(`INSERT INTO api_hits (method, path, created_at) VALUES (?, ?, ?)`).run('GET', '/', NOW);
    expect(runApiHitsChecks(db)).toEqual([]);
  });

  it('detects stale_rows', () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    db.prepare(`INSERT INTO api_hits (method, path, created_at) VALUES (?, ?, ?)`).run('GET', '/', old);
    expect(runApiHitsChecks(db).some(f => f.check === 'stale_rows')).toBe(true);
  });

  // table_too_large test skipped — would require inserting > 1M rows
});

// ─── Cross-Table Checks ────────────────────────────────────────────────────

describe('runCrossTableChecks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('detects orphaned_heartbeat', () => {
    db.prepare(`INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)`).run('agt_ghost', NOW);
    const findings = runCrossTableChecks(db);
    expect(findings.some(f => f.check === 'orphaned_heartbeat')).toBe(true);
  });

  it('detects orphaned_endorsement', () => {
    db.prepare(`INSERT INTO endorsements (id, endorser_wallet, agent_id)
      VALUES (?, ?, ?)`).run('end_orphan', GOOD_WALLET, 'agt_nope');
    const findings = runCrossTableChecks(db);
    expect(findings.some(f => f.check === 'orphaned_endorsement')).toBe(true);
  });

  it('detects stale_cooldown for free_stamp_cooldown', () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString();
    db.prepare(`INSERT INTO free_stamp_cooldown (wallet_address, last_free_mint) VALUES (?, ?)`).run(GOOD_WALLET, old);
    const findings = runCrossTableChecks(db);
    expect(findings.some(f => f.table === 'free_stamp_cooldown' && f.check === 'stale_cooldown')).toBe(true);
  });

  it('detects stale_cooldown for free_registration_cooldown', () => {
    const old = new Date(Date.now() - 35 * 86400000).toISOString();
    db.prepare(`INSERT INTO free_registration_cooldown (wallet_address, last_free_registration) VALUES (?, ?)`).run(GOOD_WALLET, old);
    const findings = runCrossTableChecks(db);
    expect(findings.some(f => f.table === 'free_registration_cooldown' && f.check === 'stale_cooldown')).toBe(true);
  });

  it('returns no findings when all references are valid', () => {
    db.prepare(`INSERT INTO agents (id, wallet_address, name, registered_at, expires_at)
      VALUES (?, ?, ?, ?, ?)`).run('agt_ok', GOOD_WALLET, 'OK Agent', NOW, FUTURE);
    db.prepare(`INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)`).run('agt_ok', NOW);
    db.prepare(`INSERT INTO endorsements (id, endorser_wallet, agent_id) VALUES (?, ?, ?)`).run('end_ok', GOOD_WALLET_2, 'agt_ok');
    expect(runCrossTableChecks(db)).toEqual([]);
  });
});

// ─── Full Report ────────────────────────────────────────────────────────────

describe('runFullReport', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns correct structure for empty database', () => {
    const report = runFullReport(db);
    expect(report).toHaveProperty('generated_at');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('findings');
    expect(report.summary).toHaveProperty('total_findings', 0);
    expect(report.summary).toHaveProperty('by_severity');
    expect(report.summary.by_severity).toEqual({ error: 0, warning: 0, info: 0 });
    expect(report.summary).toHaveProperty('by_table');
    expect(report.summary).toHaveProperty('row_counts');
    expect(Object.keys(report.summary.row_counts).length).toBe(10);
  });

  it('aggregates findings from multiple tables', () => {
    // Insert bad data in multiple tables
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('bad_id', 'bad-wallet', 'diamond', NOW, FUTURE, 'not-json', 'sig');
    db.prepare(`INSERT INTO transactions (id, endpoint, wallet_address, amount, action)
      VALUES (?, ?, ?, ?, ?)`).run('bad_txn', '/ep', GOOD_WALLET, '0', 'unknown_action');

    const report = runFullReport(db);
    expect(report.summary.total_findings).toBeGreaterThan(0);
    expect(report.summary.by_severity.error).toBeGreaterThan(0);
    expect(report.summary.by_table.stamps).toBeGreaterThan(0);
    expect(report.summary.by_table.transactions).toBeGreaterThan(0);
    expect(report.summary.row_counts.stamps).toBe(1);
    expect(report.summary.row_counts.transactions).toBe(1);
  });

  it('counts rows correctly', () => {
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('stmp_ok', GOOD_WALLET, 'gold', NOW, FUTURE, '{}', 'sig');
    db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run('stmp_ok2', GOOD_WALLET, 'silver', NOW, FUTURE, '{}', 'sig');

    const report = runFullReport(db);
    expect(report.summary.row_counts.stamps).toBe(2);
  });
});
