/**
 * Tests for the leaderboard/live query, filter, sort, and network-stats logic.
 *
 * Rather than spinning up Express or fighting CJS mock hoisting, we extract
 * the exact algorithmic logic the endpoint uses (filter, sort, limit, network
 * stats, trending) and test it against controlled inputs.  Reputation
 * computation itself is covered by the existing reputation / momentum / decay
 * test suites; here we focus on the leaderboard-specific behaviour.
 */

const { createTestDb } = require('./helpers');

const MS_PER_DAY = 86400000;
const NOW_MS = Date.now();

function daysAgo(d) { return new Date(NOW_MS - d * MS_PER_DAY).toISOString(); }
function daysFromNow(d) { return new Date(NOW_MS + d * MS_PER_DAY).toISOString(); }

/* ── Pure leaderboard helpers (mirrors the endpoint logic) ─────────────── */

function applyTierFilter(agents, tier) {
  return tier ? agents.filter(a => a.reputation.label === tier) : agents;
}

function applyTrustedFilter(agents, trustedOnly) {
  return trustedOnly ? agents.filter(a => a.reputation.score >= 10) : agents;
}

function applySorting(agents, sort) {
  const fns = {
    score: (a, b) => b.reputation.score - a.reputation.score,
    endorsements: (a, b) => b.endorsement_count - a.endorsement_count,
    uptime: (a, b) => (b.heartbeat_count || 0) - (a.heartbeat_count || 0),
    newest: (a, b) => new Date(b.registered_at) - new Date(a.registered_at),
  };
  return [...agents].sort(fns[sort] || fns.score);
}

function applyLimit(agents, limit) {
  const capped = Math.min(parseInt(limit, 10) || 50, 50);
  return agents.slice(0, capped);
}

function computeNetworkStats(agents, db) {
  const totalAgents = agents.length;
  const avgScore = totalAgents > 0
    ? Math.round(agents.reduce((s, a) => s + a.reputation.score, 0) / totalAgents)
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

  return { total_agents: totalAgents, average_score: avgScore, active_percent: activePercent, total_delegations: totalDelegations, total_stamps: totalStamps };
}

function buildTrending(enriched, rawAgents) {
  return [...enriched]
    .filter(a => a.score_trend === 'rising')
    .sort((a, b) => {
      const rA = rawAgents.find(r => r.id === a.id);
      const rB = rawAgents.find(r => r.id === b.id);
      return (b.reputation.score - (rB?.last_reputation_score || 0))
           - (a.reputation.score - (rA?.last_reputation_score || 0));
    })
    .slice(0, 5);
}

/* ── DB seed helpers ───────────────────────────────────────────────────── */

function insertAgent(db, overrides = {}) {
  const defaults = {
    id: `agt_${Math.random().toString(36).slice(2, 8)}`,
    wallet_address: '0x' + Math.random().toString(16).slice(2).padEnd(40, '0'),
    name: 'TestBot',
    description: '',
    category: 'data',
    capabilities: '[]',
    protocols: '[]',
    endpoint_url: '',
    stamp_id: null,
    endorsement_count: 0,
    status: 'active',
    registered_at: daysAgo(10),
    last_heartbeat: daysAgo(0),
    expires_at: daysFromNow(30),
    metadata: '{}',
    heartbeat_count: 10,
    last_reputation_score: null,
  };
  const a = { ...defaults, ...overrides };
  db.prepare(`INSERT INTO agents (id, wallet_address, name, description, category, capabilities,
    protocols, endpoint_url, stamp_id, endorsement_count, status, registered_at, last_heartbeat,
    expires_at, metadata, heartbeat_count, last_reputation_score)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    a.id, a.wallet_address, a.name, a.description, a.category, a.capabilities, a.protocols,
    a.endpoint_url, a.stamp_id, a.endorsement_count, a.status, a.registered_at, a.last_heartbeat,
    a.expires_at, a.metadata, a.heartbeat_count, a.last_reputation_score);
  return a;
}

function insertHeartbeat(db, agentId, recordedAt) {
  db.prepare('INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)').run(agentId, recordedAt);
}

function insertDelegation(db, from, to) {
  db.prepare("INSERT INTO trust_delegations (id, delegator_wallet, delegatee_wallet, weight, expires_at) VALUES (?,?,?,1.0,?)")
    .run(`del_${Math.random().toString(36).slice(2, 8)}`, from, to, daysFromNow(7));
}

function insertStamp(db, wallet, tier = 'bronze') {
  const id = `stp_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare("INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked) VALUES (?,?,?,?,?,'c','s',0)")
    .run(id, wallet, tier, daysAgo(5), daysFromNow(25));
  return id;
}

/**
 * Build an "enriched" agent object the same shape the endpoint produces,
 * but with a synthetic reputation score/label so we don't need the real
 * computeReputation (already unit-tested separately).
 */
function enrichAgent(raw, score, extra = {}) {
  const label = score <= 25 ? 'new' : score <= 50 ? 'emerging' : score <= 75 ? 'established' : 'elite';
  let scoreTrend = 'stable';
  if (raw.last_reputation_score !== null) {
    const delta = score - raw.last_reputation_score;
    if (delta >= 3) scoreTrend = 'rising';
    else if (delta <= -3) scoreTrend = 'falling';
  }
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    wallet_address: raw.wallet_address,
    endorsement_count: raw.endorsement_count || 0,
    heartbeat_count: raw.heartbeat_count || 0,
    registered_at: raw.registered_at,
    reputation: {
      score,
      label,
      breakdown: extra.breakdown || { tier: 0, endorsements: 0, uptime: 0, momentum: 0, wishes: 0, decay_info: { penalty: 0 } },
    },
    delegations_received: extra.delegations_received || 0,
    score_trend: scoreTrend,
  };
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

let db;

beforeEach(() => { db = createTestDb(); });
afterEach(() => { if (db) db.close(); db = null; });

describe('Leaderboard Live', () => {

  it('1. Default sort by score descending', () => {
    const a1 = insertAgent(db, { id: 'agt_high', endorsement_count: 4 });
    const a2 = insertAgent(db, { id: 'agt_low', endorsement_count: 0 });

    const enriched = [
      enrichAgent(a1, 55),
      enrichAgent(a2, 12),
    ];

    const sorted = applySorting(enriched, 'score');
    expect(sorted[0].id).toBe('agt_high');
    expect(sorted[0].reputation.score).toBeGreaterThanOrEqual(sorted[1].reputation.score);
  });

  it('2. Category filter works', () => {
    const a1 = insertAgent(db, { id: 'agt_d', category: 'data' });
    const a2 = insertAgent(db, { id: 'agt_t', category: 'trading' });
    const a3 = insertAgent(db, { id: 'agt_r', category: 'research' });

    // Simulate the SQL category filter by querying the db
    const tradingAgents = db.prepare("SELECT * FROM agents WHERE status='active' AND category=?").all('trading');
    expect(tradingAgents.length).toBe(1);
    expect(tradingAgents[0].id).toBe('agt_t');
  });

  it('3. Trusted-only filter excludes low-score agents', () => {
    const a1 = insertAgent(db, { id: 'agt_trusted' });
    const a2 = insertAgent(db, { id: 'agt_untrusted' });

    const enriched = [
      enrichAgent(a1, 30),
      enrichAgent(a2, 5),
    ];

    const filtered = applyTrustedFilter(enriched, true);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('agt_trusted');
    // All returned agents must have score >= 10
    for (const a of filtered) {
      expect(a.reputation.score).toBeGreaterThanOrEqual(10);
    }
  });

  it('4. Sort by endorsements works', () => {
    const a1 = insertAgent(db, { id: 'agt_few', endorsement_count: 1 });
    const a2 = insertAgent(db, { id: 'agt_many', endorsement_count: 10 });
    const a3 = insertAgent(db, { id: 'agt_mid', endorsement_count: 5 });

    const enriched = [
      enrichAgent(a1, 10),
      enrichAgent(a2, 10),
      enrichAgent(a3, 10),
    ];

    const sorted = applySorting(enriched, 'endorsements');
    expect(sorted[0].endorsement_count).toBe(10);
    expect(sorted[1].endorsement_count).toBe(5);
    expect(sorted[2].endorsement_count).toBe(1);
  });

  it('5. Network stats computed correctly', () => {
    const wA = '0x' + 'd'.repeat(40);
    const wB = '0x' + 'e'.repeat(40);
    const stampId = insertStamp(db, wA, 'gold');

    const a1 = insertAgent(db, { id: 'agt_net1', wallet_address: wA, stamp_id: stampId, endorsement_count: 3, heartbeat_count: 10 });
    const a2 = insertAgent(db, { id: 'agt_net2', wallet_address: wB, endorsement_count: 1, heartbeat_count: 5 });

    insertHeartbeat(db, 'agt_net1', new Date().toISOString());
    insertDelegation(db, wA, wB);

    const enriched = [
      enrichAgent(a1, 60),
      enrichAgent(a2, 20),
    ];

    const stats = computeNetworkStats(enriched, db);

    expect(stats.total_agents).toBe(2);
    expect(stats.average_score).toBe(40); // (60 + 20) / 2
    expect(stats.total_delegations).toBe(1);
    expect(stats.total_stamps).toBe(1);
    expect(stats.active_percent).toBe(50); // 1 of 2 agents had recent heartbeat
  });

  it('6. Empty database returns sensible defaults', () => {
    const enriched = [];
    const stats = computeNetworkStats(enriched, db);

    expect(stats).toEqual({
      total_agents: 0,
      average_score: 0,
      active_percent: 0,
      total_delegations: 0,
      total_stamps: 0,
    });

    const trending = buildTrending(enriched, []);
    expect(trending).toEqual([]);
  });

  it('7. Limit caps at 50', () => {
    // Build 55 enriched agents
    const agents = [];
    for (let i = 0; i < 55; i++) {
      const raw = insertAgent(db, { id: `agt_b_${i}` });
      agents.push(enrichAgent(raw, 10 + (i % 30)));
    }

    const resultDefault = applyLimit(agents, undefined);
    expect(resultDefault.length).toBe(50);

    const resultOver = applyLimit(agents, '100');
    expect(resultOver.length).toBe(50);

    const resultUnder = applyLimit(agents, '10');
    expect(resultUnder.length).toBe(10);
  });

});
