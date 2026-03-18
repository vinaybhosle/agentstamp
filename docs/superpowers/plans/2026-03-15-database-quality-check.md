# Database Data Quality Check Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI script and API endpoint that runs a comprehensive data quality audit across all 10 SQLite tables, reporting orphans, schema violations, stale data, and inconsistencies — with a JSON report and optional auto-fix mode.

**Architecture:** A single `scripts/db-quality-check.js` script that initializes the database in read-only mode, runs checks organized by table, collects findings into a structured report, and optionally fixes safe issues (stale data cleanup). An API endpoint (`GET /api/v1/admin/db-quality`) exposes the same checks behind the analytics key. Tests use vitest with an in-memory SQLite database seeded with known-bad data.

**Tech Stack:** Node.js, better-sqlite3 (already installed), vitest (add as devDependency)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/db-quality-check.js` | CLI entry point — parses args, runs checks, prints report |
| `src/dataQualityChecks.js` | Core check functions — pure logic, takes a `db` handle, returns findings |
| `tests/dataQualityChecks.test.js` | Vitest tests with in-memory SQLite seeded with bad data |
| `src/routes/admin.js` | `GET /api/v1/admin/db-quality` endpoint (behind analytics key) |

---

## Chunk 1: Core Quality Checks

### Task 1: Set up vitest and test scaffold

**Files:**
- Modify: `package.json` (add vitest devDependency + test script)
- Create: `tests/dataQualityChecks.test.js`

- [ ] **Step 1: Install vitest**

```bash
cd /Users/vinaybhosle/Desktop/AgentStamp && npm install --save-dev vitest
```

- [ ] **Step 2: Add test script and vitest config to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

Create `vitest.config.js`:
```js
const { defineConfig } = require('vitest/config');
module.exports = defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: Create shared test helper**

Create `tests/helpers.js`:
```js
const Database = require('better-sqlite3');

// Schema copied from src/database.js — create tables in memory
// Includes UNIQUE constraints matching production schema
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = OFF'); // Allow inserting orphans for testing
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
      heartbeat_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      registered_at TEXT NOT NULL,
      last_heartbeat TEXT,
      expires_at TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE endorsements (
      id TEXT PRIMARY KEY,
      endorser_wallet TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  `);
  return db;
}

module.exports = { createTestDb };
```

- [ ] **Step 4: Create test scaffold**

Create `tests/dataQualityChecks.test.js`:
```js
const { createTestDb } = require('./helpers');

describe('dataQualityChecks', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify setup works**

Run: `cd /Users/vinaybhosle/Desktop/AgentStamp && npx vitest run tests/dataQualityChecks.test.js`
Expected: 1 test passes

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js tests/helpers.js tests/dataQualityChecks.test.js
git commit -m "test: add vitest setup and in-memory DB helper for data quality checks"
```

---

### Task 2: Implement stamps table checks

**Files:**
- Create: `src/dataQualityChecks.js`
- Modify: `tests/dataQualityChecks.test.js`

- [ ] **Step 1: Write failing tests for stamps checks**

Add to `tests/dataQualityChecks.test.js` (after the existing imports):
```js
const { runStampsChecks } = require('../src/dataQualityChecks');

describe('stamps checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects invalid wallet addresses', () => {
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_good1', '0x' + 'a'.repeat(40), 'gold', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', '{}', 'sig'
    );
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_bad1', 'not-a-wallet', 'gold', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', '{}', 'sig'
    );
    const findings = runStampsChecks(db);
    const walletIssues = findings.filter(f => f.check === 'invalid_wallet_address');
    expect(walletIssues).toHaveLength(1);
    expect(walletIssues[0].row_id).toBe('stmp_bad1');
  });

  it('detects invalid tiers', () => {
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_badtier', '0x' + 'a'.repeat(40), 'platinum', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', '{}', 'sig'
    );
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'invalid_tier')).toBe(true);
  });

  it('detects expired but not revoked stamps', () => {
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_stale', '0x' + 'a'.repeat(40), 'bronze', '2024-01-01T00:00:00Z', '2024-02-01T00:00:00Z', '{}', 'sig', 0
    );
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'expired_not_revoked')).toBe(true);
  });

  it('detects invalid certificate JSON', () => {
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_badjson', '0x' + 'a'.repeat(40), 'gold', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', 'not-json', 'sig'
    );
    const findings = runStampsChecks(db);
    expect(findings.some(f => f.check === 'invalid_certificate_json')).toBe(true);
  });

  it('reports clean for valid data', () => {
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_ok', '0x' + 'a'.repeat(40), 'gold', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', '{"version":"1.0"}', 'sig'
    );
    const findings = runStampsChecks(db);
    expect(findings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: FAIL — `runStampsChecks` is not defined

- [ ] **Step 3: Implement stamps checks**

Create `src/dataQualityChecks.js`:
```js
const VALID_TIERS = ['free', 'bronze', 'silver', 'gold'];
const VALID_AGENT_CATEGORIES = ['data', 'trading', 'research', 'creative', 'infrastructure', 'other'];
const VALID_WISH_CATEGORIES = ['capability', 'data', 'connection', 'existential', 'other'];
const VALID_AGENT_STATUSES = ['active', 'expired'];
const VALID_ACTIONS = ['free_mint', 'stamp_mint', 'free_register', 'agent_register', 'register', 'agent_update', 'agent_endorse', 'wish_create', 'wish_grant'];
const VALID_WEBHOOK_EVENTS = ['stamp_minted', 'stamp_expiring', 'endorsement_received', 'wish_granted', 'wish_matched', 'reputation_changed', 'agent_registered'];
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

function finding(table, check, severity, row_id, detail) {
  return { table, check, severity, row_id, detail };
}

function runStampsChecks(db) {
  const findings = [];
  const stamps = db.prepare('SELECT * FROM stamps').all();
  const now = new Date().toISOString();

  for (const s of stamps) {
    if (!WALLET_REGEX.test(s.wallet_address)) {
      findings.push(finding('stamps', 'invalid_wallet_address', 'error', s.id, `wallet: ${s.wallet_address}`));
    }
    if (!VALID_TIERS.includes(s.tier)) {
      findings.push(finding('stamps', 'invalid_tier', 'error', s.id, `tier: ${s.tier}`));
    }
    if (s.expires_at < now && !s.revoked) {
      findings.push(finding('stamps', 'expired_not_revoked', 'warning', s.id, `expired ${s.expires_at}, revoked=0`));
    }
    try { JSON.parse(s.certificate); } catch {
      findings.push(finding('stamps', 'invalid_certificate_json', 'error', s.id, 'certificate is not valid JSON'));
    }
    if (!s.id.startsWith('stmp_')) {
      findings.push(finding('stamps', 'invalid_id_prefix', 'warning', s.id, `expected stmp_ prefix`));
    }
  }
  return findings;
}

module.exports = { runStampsChecks };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: All stamps tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dataQualityChecks.js tests/dataQualityChecks.test.js
git commit -m "feat: add stamps table data quality checks with tests"
```

---

### Task 3: Implement agents table checks

**Files:**
- Modify: `src/dataQualityChecks.js`
- Modify: `tests/dataQualityChecks.test.js`

- [ ] **Step 1: Write failing tests for agents checks**

Add to `tests/dataQualityChecks.test.js`:
```js
const { runAgentsChecks } = require('../src/dataQualityChecks');

describe('agents checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects orphaned stamp_id references', () => {
    db.prepare("INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, stamp_id) VALUES (?, ?, ?, ?, ?, ?)").run(
      'agt_orphan', '0x' + 'a'.repeat(40), 'Test', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', 'stmp_nonexistent'
    );
    const findings = runAgentsChecks(db);
    expect(findings.some(f => f.check === 'orphaned_stamp_id')).toBe(true);
  });

  it('detects endorsement count mismatch', () => {
    db.prepare("INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, endorsement_count) VALUES (?, ?, ?, ?, ?, ?)").run(
      'agt_mismatch', '0x' + 'a'.repeat(40), 'Test', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', 5
    );
    // No endorsements exist, but count says 5
    const findings = runAgentsChecks(db);
    expect(findings.some(f => f.check === 'endorsement_count_mismatch')).toBe(true);
  });

  it('detects invalid category', () => {
    db.prepare("INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, category) VALUES (?, ?, ?, ?, ?, ?)").run(
      'agt_badcat', '0x' + 'a'.repeat(40), 'Test', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', 'invalid_cat'
    );
    const findings = runAgentsChecks(db);
    expect(findings.some(f => f.check === 'invalid_category')).toBe(true);
  });

  it('detects invalid capabilities JSON', () => {
    db.prepare("INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, capabilities) VALUES (?, ?, ?, ?, ?, ?)").run(
      'agt_badjson', '0x' + 'a'.repeat(40), 'Test', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', 'not-json'
    );
    const findings = runAgentsChecks(db);
    expect(findings.some(f => f.check === 'invalid_capabilities_json')).toBe(true);
  });

  it('detects active agents past expiry', () => {
    db.prepare("INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?)").run(
      'agt_stale', '0x' + 'a'.repeat(40), 'Test', '2024-01-01T00:00:00Z', '2024-06-01T00:00:00Z', 'active'
    );
    const findings = runAgentsChecks(db);
    expect(findings.some(f => f.check === 'active_but_expired')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: FAIL — `runAgentsChecks` not exported

- [ ] **Step 3: Implement agents checks**

Add to `src/dataQualityChecks.js`, before `module.exports`:
```js
function runAgentsChecks(db) {
  const findings = [];
  const agents = db.prepare('SELECT * FROM agents').all();
  const now = new Date().toISOString();

  for (const a of agents) {
    if (!WALLET_REGEX.test(a.wallet_address)) {
      findings.push(finding('agents', 'invalid_wallet_address', 'error', a.id, `wallet: ${a.wallet_address}`));
    }
    if (!a.id.startsWith('agt_')) {
      findings.push(finding('agents', 'invalid_id_prefix', 'warning', a.id, 'expected agt_ prefix'));
    }
    if (a.category && !VALID_AGENT_CATEGORIES.includes(a.category)) {
      findings.push(finding('agents', 'invalid_category', 'error', a.id, `category: ${a.category}`));
    }
    if (a.status && !VALID_AGENT_STATUSES.includes(a.status)) {
      findings.push(finding('agents', 'invalid_status', 'error', a.id, `status: ${a.status}`));
    }
    if (a.status === 'active' && a.expires_at < now) {
      findings.push(finding('agents', 'active_but_expired', 'warning', a.id, `status=active but expired ${a.expires_at}`));
    }
    if (a.stamp_id) {
      const stamp = db.prepare('SELECT id FROM stamps WHERE id = ?').get(a.stamp_id);
      if (!stamp) {
        findings.push(finding('agents', 'orphaned_stamp_id', 'error', a.id, `stamp_id ${a.stamp_id} not in stamps table`));
      }
    }
    // Endorsement count consistency
    const actualCount = db.prepare('SELECT COUNT(*) as c FROM endorsements WHERE agent_id = ?').get(a.id).c;
    if (a.endorsement_count !== actualCount) {
      findings.push(finding('agents', 'endorsement_count_mismatch', 'warning', a.id, `stored=${a.endorsement_count} actual=${actualCount}`));
    }
    // JSON fields
    for (const field of ['capabilities', 'protocols', 'metadata']) {
      if (a[field]) {
        try { JSON.parse(a[field]); } catch {
          findings.push(finding('agents', `invalid_${field}_json`, 'error', a.id, `${field} is not valid JSON`));
        }
      }
    }
  }
  return findings;
}
```

Update `module.exports` to include `runAgentsChecks`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/dataQualityChecks.js tests/dataQualityChecks.test.js
git commit -m "feat: add agents table data quality checks with tests"
```

---

### Task 4: Implement remaining table checks (endorsements, wishes, transactions, webhooks, heartbeat_log, cooldowns, api_hits)

**Files:**
- Modify: `src/dataQualityChecks.js`
- Modify: `tests/dataQualityChecks.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/dataQualityChecks.test.js`:
```js
const { runEndorsementsChecks, runWishesChecks, runTransactionsChecks, runWebhooksChecks, runHeartbeatChecks, runApiHitsChecks, runCrossTableChecks } = require('../src/dataQualityChecks');

describe('endorsements checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects orphaned agent_id', () => {
    db.prepare("INSERT INTO endorsements (id, endorser_wallet, agent_id) VALUES (?, ?, ?)").run(
      'end_orphan', '0x' + 'a'.repeat(40), 'agt_nonexistent'
    );
    const findings = runEndorsementsChecks(db);
    expect(findings.some(f => f.check === 'orphaned_agent_id')).toBe(true);
  });
});

describe('wishes checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects invalid category', () => {
    db.prepare("INSERT INTO wishes (id, wallet_address, wish_text, category) VALUES (?, ?, ?, ?)").run(
      'wish_bad', '0x' + 'a'.repeat(40), 'I wish', 'bad_category'
    );
    const findings = runWishesChecks(db);
    expect(findings.some(f => f.check === 'invalid_category')).toBe(true);
  });

  it('detects granted without granted_at', () => {
    db.prepare("INSERT INTO wishes (id, wallet_address, wish_text, category, granted) VALUES (?, ?, ?, ?, ?)").run(
      'wish_nodate', '0x' + 'a'.repeat(40), 'I wish', 'capability', 1
    );
    const findings = runWishesChecks(db);
    expect(findings.some(f => f.check === 'granted_without_timestamp')).toBe(true);
  });
});

describe('webhooks checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects invalid events JSON', () => {
    db.prepare("INSERT INTO webhooks (id, wallet_address, url, events, secret) VALUES (?, ?, ?, ?, ?)").run(
      'whk_bad', '0x' + 'a'.repeat(40), 'https://example.com', 'not-json', 'secret'
    );
    const findings = runWebhooksChecks(db);
    expect(findings.some(f => f.check === 'invalid_events_json')).toBe(true);
  });

  it('detects unknown event types', () => {
    db.prepare("INSERT INTO webhooks (id, wallet_address, url, events, secret) VALUES (?, ?, ?, ?, ?)").run(
      'whk_unk', '0x' + 'a'.repeat(40), 'https://example.com', '["unknown_event"]', 'secret'
    );
    const findings = runWebhooksChecks(db);
    expect(findings.some(f => f.check === 'unknown_event_type')).toBe(true);
  });
});

describe('transactions checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects unknown action types', () => {
    db.prepare("INSERT INTO transactions (id, endpoint, wallet_address, amount, action) VALUES (?, ?, ?, ?, ?)").run(
      'txn_bad', '/api/v1/foo', '0x' + 'a'.repeat(40), '$0.01', 'unknown_action'
    );
    const findings = runTransactionsChecks(db);
    expect(findings.some(f => f.check === 'unknown_action')).toBe(true);
  });

  it('detects invalid id prefix', () => {
    db.prepare("INSERT INTO transactions (id, endpoint, wallet_address, amount, action) VALUES (?, ?, ?, ?, ?)").run(
      'bad_prefix', '/api/v1/stamp/mint/gold', '0x' + 'a'.repeat(40), '$0.01', 'stamp_mint'
    );
    const findings = runTransactionsChecks(db);
    expect(findings.some(f => f.check === 'invalid_id_prefix')).toBe(true);
  });
});

describe('api_hits checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('reports clean for small table', () => {
    const findings = runApiHitsChecks(db);
    expect(findings).toHaveLength(0);
  });
});

describe('heartbeat checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('reports clean for small heartbeat table', () => {
    const findings = runHeartbeatChecks(db);
    expect(findings).toHaveLength(0);
  });
});

describe('cross-table checks', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('detects heartbeat logs for nonexistent agents', () => {
    db.prepare("INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)").run(
      'agt_gone', '2026-01-01T00:00:00Z'
    );
    const findings = runCrossTableChecks(db);
    expect(findings.some(f => f.check === 'orphaned_heartbeat')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: FAIL

- [ ] **Step 3: Implement all remaining checks**

Add to `src/dataQualityChecks.js`:
```js
function runEndorsementsChecks(db) {
  const findings = [];
  const endorsements = db.prepare('SELECT * FROM endorsements').all();
  for (const e of endorsements) {
    if (!WALLET_REGEX.test(e.endorser_wallet)) {
      findings.push(finding('endorsements', 'invalid_wallet_address', 'error', e.id, `endorser_wallet: ${e.endorser_wallet}`));
    }
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(e.agent_id);
    if (!agent) {
      findings.push(finding('endorsements', 'orphaned_agent_id', 'error', e.id, `agent_id ${e.agent_id} not in agents`));
    }
    if (!e.id.startsWith('end_')) {
      findings.push(finding('endorsements', 'invalid_id_prefix', 'warning', e.id, 'expected end_ prefix'));
    }
  }
  return findings;
}

function runWishesChecks(db) {
  const findings = [];
  const wishes = db.prepare('SELECT * FROM wishes').all();
  for (const w of wishes) {
    if (!WALLET_REGEX.test(w.wallet_address)) {
      findings.push(finding('wishes', 'invalid_wallet_address', 'error', w.id, `wallet: ${w.wallet_address}`));
    }
    if (w.category && !VALID_WISH_CATEGORIES.includes(w.category)) {
      findings.push(finding('wishes', 'invalid_category', 'error', w.id, `category: ${w.category}`));
    }
    if (w.granted && !w.granted_at) {
      findings.push(finding('wishes', 'granted_without_timestamp', 'warning', w.id, 'granted=1 but no granted_at'));
    }
    if (w.agent_id) {
      const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(w.agent_id);
      if (!agent) {
        findings.push(finding('wishes', 'orphaned_agent_id', 'warning', w.id, `agent_id ${w.agent_id} not in agents`));
      }
    }
    if (!w.id.startsWith('wish_')) {
      findings.push(finding('wishes', 'invalid_id_prefix', 'warning', w.id, 'expected wish_ prefix'));
    }
  }
  return findings;
}

function runTransactionsChecks(db) {
  const findings = [];
  const txns = db.prepare('SELECT * FROM transactions').all();
  for (const t of txns) {
    if (!t.id.startsWith('txn_')) {
      findings.push(finding('transactions', 'invalid_id_prefix', 'warning', t.id, 'expected txn_ prefix'));
    }
    if (!VALID_ACTIONS.includes(t.action)) {
      findings.push(finding('transactions', 'unknown_action', 'warning', t.id, `action: ${t.action}`));
    }
  }
  return findings;
}

function runWebhooksChecks(db) {
  const findings = [];
  const hooks = db.prepare('SELECT * FROM webhooks').all();
  for (const h of hooks) {
    if (!WALLET_REGEX.test(h.wallet_address)) {
      findings.push(finding('webhooks', 'invalid_wallet_address', 'error', h.wallet_address, `wallet: ${h.wallet_address}`));
    }
    let events;
    try {
      events = JSON.parse(h.events);
      if (!Array.isArray(events)) throw new Error('not array');
    } catch {
      findings.push(finding('webhooks', 'invalid_events_json', 'error', h.id, 'events is not valid JSON array'));
      continue;
    }
    for (const evt of events) {
      if (!VALID_WEBHOOK_EVENTS.includes(evt)) {
        findings.push(finding('webhooks', 'unknown_event_type', 'warning', h.id, `event: ${evt}`));
      }
    }
    try { new URL(h.url); } catch {
      findings.push(finding('webhooks', 'invalid_url', 'error', h.id, `url: ${h.url}`));
    }
  }
  return findings;
}

function runHeartbeatChecks(db) {
  const findings = [];
  // Check for massive heartbeat logs (>10k per agent)
  const heavy = db.prepare('SELECT agent_id, COUNT(*) as c FROM heartbeat_log GROUP BY agent_id HAVING c > 10000').all();
  for (const h of heavy) {
    findings.push(finding('heartbeat_log', 'excessive_heartbeats', 'warning', h.agent_id, `${h.c} heartbeat rows`));
  }
  return findings;
}

function runApiHitsChecks(db) {
  const findings = [];
  const total = db.prepare('SELECT COUNT(*) as c FROM api_hits').get().c;
  if (total > 1000000) {
    findings.push(finding('api_hits', 'table_too_large', 'warning', null, `${total} rows — consider rotating old data`));
  }
  // Check for rows older than 90 days
  const stale = db.prepare("SELECT COUNT(*) as c FROM api_hits WHERE created_at < datetime('now', '-90 days')").get().c;
  if (stale > 0) {
    findings.push(finding('api_hits', 'stale_rows', 'info', null, `${stale} rows older than 90 days`));
  }
  return findings;
}

function runCrossTableChecks(db) {
  const findings = [];
  // Orphaned heartbeat logs
  const orphanedHb = db.prepare('SELECT DISTINCT agent_id FROM heartbeat_log WHERE agent_id NOT IN (SELECT id FROM agents)').all();
  for (const h of orphanedHb) {
    findings.push(finding('heartbeat_log', 'orphaned_heartbeat', 'warning', h.agent_id, 'agent_id not in agents table'));
  }
  // Orphaned endorsements
  const orphanedEnd = db.prepare('SELECT id, agent_id FROM endorsements WHERE agent_id NOT IN (SELECT id FROM agents)').all();
  for (const e of orphanedEnd) {
    findings.push(finding('endorsements', 'orphaned_endorsement', 'error', e.id, `agent_id ${e.agent_id} not in agents`));
  }
  // Cooldown wallets with no corresponding stamps/agents
  const staleCooldowns = db.prepare('SELECT wallet_address FROM free_stamp_cooldown WHERE wallet_address NOT IN (SELECT wallet_address FROM stamps)').all();
  for (const c of staleCooldowns) {
    findings.push(finding('free_stamp_cooldown', 'stale_cooldown', 'info', c.wallet_address, 'cooldown entry but no stamps found'));
  }
  return findings;
}
```

Update `module.exports` to export all new functions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/dataQualityChecks.js tests/dataQualityChecks.test.js
git commit -m "feat: add quality checks for all remaining tables (endorsements, wishes, txns, webhooks, heartbeats, api_hits, cross-table)"
```

---

## Chunk 2: CLI Script, API Endpoint, and Full Report Runner

### Task 5: Implement the full report runner

**Files:**
- Modify: `src/dataQualityChecks.js`

- [ ] **Step 1: Write failing test for runFullReport**

Add to `tests/dataQualityChecks.test.js`:
```js
const { runFullReport } = require('../src/dataQualityChecks');

describe('runFullReport', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('returns structured report with summary', () => {
    // Insert one bad row
    db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'stmp_bad', 'bad-wallet', 'gold', '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', '{}', 'sig'
    );
    const report = runFullReport(db);
    expect(report).toHaveProperty('generated_at');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('findings');
    expect(report.summary.total_findings).toBeGreaterThan(0);
    expect(report.summary.by_severity).toHaveProperty('error');
    expect(report.summary.by_table).toHaveProperty('stamps');
  });

  it('returns clean report for empty database', () => {
    const report = runFullReport(db);
    expect(report.summary.total_findings).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: FAIL

- [ ] **Step 3: Implement runFullReport**

Add to `src/dataQualityChecks.js`:
```js
function runFullReport(db) {
  const allChecks = [
    ...runStampsChecks(db),
    ...runAgentsChecks(db),
    ...runEndorsementsChecks(db),
    ...runWishesChecks(db),
    ...runTransactionsChecks(db),
    ...runWebhooksChecks(db),
    ...runHeartbeatChecks(db),
    ...runApiHitsChecks(db),
    ...runCrossTableChecks(db),
  ];

  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byTable = {};
  for (const f of allChecks) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byTable[f.table] = (byTable[f.table] || 0) + 1;
  }

  // Table row counts
  const tables = ['stamps', 'agents', 'endorsements', 'wishes', 'transactions', 'heartbeat_log', 'free_stamp_cooldown', 'free_registration_cooldown', 'webhooks', 'api_hits'];
  const rowCounts = {};
  for (const t of tables) {
    try { rowCounts[t] = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; } catch { rowCounts[t] = -1; }
  }

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_findings: allChecks.length,
      by_severity: bySeverity,
      by_table: byTable,
      row_counts: rowCounts,
    },
    findings: allChecks,
  };
}
```

Export `runFullReport`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/dataQualityChecks.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/dataQualityChecks.js tests/dataQualityChecks.test.js
git commit -m "feat: add runFullReport aggregation function"
```

---

### Task 6: Create CLI script

**Files:**
- Create: `scripts/db-quality-check.js`

- [ ] **Step 1: Create CLI script**

Create `scripts/db-quality-check.js`:
```js
#!/usr/bin/env node
/**
 * AgentStamp — Database Quality Check CLI
 *
 * Usage:
 *   node scripts/db-quality-check.js                  # Full report (stdout JSON)
 *   node scripts/db-quality-check.js --summary        # Summary only
 *   node scripts/db-quality-check.js --fix            # Auto-fix safe issues (expired stamps, stale status)
 *   node scripts/db-quality-check.js --table stamps   # Check single table
 */
require('dotenv').config();
const Database = require('better-sqlite3');
const { runFullReport, runStampsChecks, runAgentsChecks, runEndorsementsChecks, runWishesChecks, runTransactionsChecks, runWebhooksChecks, runHeartbeatChecks, runApiHitsChecks, runCrossTableChecks } = require('../src/dataQualityChecks');

// Use DB_PATH directly — don't import config.js which requires WALLET_ADDRESS
const dbPath = process.env.DB_PATH || './data/agentstamp.db';

const args = process.argv.slice(2);
const summaryOnly = args.includes('--summary');
const autoFix = args.includes('--fix');
const tableFlag = args.indexOf('--table');
const singleTable = tableFlag !== -1 ? args[tableFlag + 1] : null;

const db = new Database(dbPath, { readonly: !autoFix });

if (autoFix) {
  console.error('[db-quality] Running auto-fix...');
  const now = new Date().toISOString();

  // Fix 1: Mark expired agents as expired
  const fixedAgents = db.prepare("UPDATE agents SET status = 'expired' WHERE expires_at < ? AND status = 'active'").run(now);
  console.error(`  Fixed ${fixedAgents.changes} agents with active status past expiry`);

  // Fix 2: Revoke expired stamps
  const fixedStamps = db.prepare("UPDATE stamps SET revoked = 1 WHERE expires_at < ? AND revoked = 0").run(now);
  console.error(`  Fixed ${fixedStamps.changes} expired stamps not marked as revoked`);

  // Fix 3: Correct endorsement counts
  const agents = db.prepare('SELECT id FROM agents').all();
  let fixedCounts = 0;
  for (const a of agents) {
    const actual = db.prepare('SELECT COUNT(*) as c FROM endorsements WHERE agent_id = ?').get(a.id).c;
    const result = db.prepare('UPDATE agents SET endorsement_count = ? WHERE id = ? AND endorsement_count != ?').run(actual, a.id, actual);
    fixedCounts += result.changes;
  }
  console.error(`  Fixed ${fixedCounts} endorsement count mismatches`);

  // Fix 4: Delete api_hits older than 90 days
  const oldHits = db.prepare("DELETE FROM api_hits WHERE created_at < datetime('now', '-90 days')").run();
  console.error(`  Cleaned ${oldHits.changes} api_hits rows older than 90 days`);

  console.error('[db-quality] Auto-fix complete.\n');
}

let report;
if (singleTable) {
  const checkMap = {
    stamps: runStampsChecks,
    agents: runAgentsChecks,
    endorsements: runEndorsementsChecks,
    wishes: runWishesChecks,
    transactions: runTransactionsChecks,
    webhooks: runWebhooksChecks,
    heartbeat_log: runHeartbeatChecks,
    api_hits: runApiHitsChecks,
  };
  const fn = checkMap[singleTable];
  if (!fn) {
    console.error(`Unknown table: ${singleTable}. Valid: ${Object.keys(checkMap).join(', ')}`);
    process.exit(1);
  }
  const findings = fn(db);
  report = { generated_at: new Date().toISOString(), table: singleTable, findings };
} else {
  report = runFullReport(db);
}

if (summaryOnly && report.summary) {
  console.log(JSON.stringify(report.summary, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}

// Exit with code 1 if errors found
const errorCount = report.summary?.by_severity?.error || report.findings?.filter(f => f.severity === 'error').length || 0;
process.exit(errorCount > 0 ? 1 : 0);
```

- [ ] **Step 2: Test CLI runs against actual DB**

Run: `cd /Users/vinaybhosle/Desktop/AgentStamp && node scripts/db-quality-check.js --summary`
Expected: JSON summary output, exit code 0 (or 1 if errors found — both are valid)

- [ ] **Step 3: Commit**

```bash
git add scripts/db-quality-check.js
git commit -m "feat: add CLI script for database quality checks"
```

---

### Task 7: Create admin API endpoint

**Files:**
- Create: `src/routes/admin.js`
- Modify: `server.js` (mount route)

- [ ] **Step 1: Create admin route**

Create `src/routes/admin.js`:
```js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDb } = require('../database');
const { runFullReport } = require('../dataQualityChecks');

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAnalyticsKey(req, res, next) {
  const key = req.headers['x-analytics-key'];
  const expected = process.env.ANALYTICS_KEY;
  if (!expected) return res.status(503).json({ error: 'Analytics not configured' });
  if (!key || !timingSafeEqual(key, expected)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(requireAnalyticsKey);

// GET /api/v1/admin/db-quality — Run data quality checks
router.get('/db-quality', (req, res) => {
  try {
    const db = getDb();
    const report = runFullReport(db);
    res.json({ success: true, ...report });
  } catch (err) {
    console.error('DB quality check error:', err);
    res.status(500).json({ success: false, error: 'Failed to run quality checks' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route in server.js**

In `server.js`, add after `const trustRoutes = require('./src/routes/trust');`:
```js
const adminRoutes = require('./src/routes/admin');
```

And in the routes section (after `app.use('/api/v1/trust', trustRoutes);`), add:
```js
  app.use('/api/v1/admin', adminRoutes);
```

- [ ] **Step 3: Verify server still starts**

Run: `cd /Users/vinaybhosle/Desktop/AgentStamp && node --check server.js`
Expected: No output (exit code 0 = syntax OK)

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.js server.js
git commit -m "feat: add admin API endpoint for database quality checks"
```

---

### Task 8: Add npm script shortcut

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add db-check scripts**

In `package.json` `"scripts"`, add:
```json
"db:check": "node scripts/db-quality-check.js",
"db:check:summary": "node scripts/db-quality-check.js --summary",
"db:fix": "node scripts/db-quality-check.js --fix --summary"
```

- [ ] **Step 2: Verify**

Run: `cd /Users/vinaybhosle/Desktop/AgentStamp && npm run db:check:summary`
Expected: JSON output

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add npm scripts for database quality checks"
```
