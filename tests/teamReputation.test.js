const { createTestDb } = require('./helpers');

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();

function seedTeamTestData(db) {
  // Agent 1: Gold stamp, 3 endorsements → high score
  db.prepare(`INSERT INTO agents (id, wallet_address, name, category, endorsement_count, status, registered_at, last_heartbeat, expires_at, wallet_verified, heartbeat_count)
    VALUES ('agent1', '0xAAA', 'HighTrust', 'data', 3, 'active', ?, ?, ?, 1, 50)`).run(NOW, NOW, FUTURE);
  db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
    VALUES ('s1', '0xAAA', 'gold', ?, ?, 'cert', 'sig', 0)`).run(NOW, FUTURE);

  // Agent 2: Silver stamp, 1 endorsement → medium score
  db.prepare(`INSERT INTO agents (id, wallet_address, name, category, endorsement_count, status, registered_at, last_heartbeat, expires_at, wallet_verified, heartbeat_count)
    VALUES ('agent2', '0xBBB', 'MedTrust', 'research', 1, 'active', ?, ?, ?, 0, 20)`).run(NOW, NOW, FUTURE);
  db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
    VALUES ('s2', '0xBBB', 'silver', ?, ?, 'cert', 'sig', 0)`).run(NOW, FUTURE);

  // Agent 3: Free stamp, 0 endorsements → low score
  db.prepare(`INSERT INTO agents (id, wallet_address, name, category, endorsement_count, status, registered_at, last_heartbeat, expires_at, wallet_verified, heartbeat_count)
    VALUES ('agent3', '0xCCC', 'LowTrust', 'creative', 0, 'active', ?, ?, ?, 0, 2)`).run(NOW, NOW, FUTURE);
  db.prepare(`INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
    VALUES ('s3', '0xCCC', 'free', ?, ?, 'cert', 'sig', 0)`).run(NOW, FUTURE);

  // Agent 4: No stamp → very low score
  db.prepare(`INSERT INTO agents (id, wallet_address, name, category, endorsement_count, status, registered_at, last_heartbeat, expires_at, wallet_verified, heartbeat_count)
    VALUES ('agent4', '0xDDD', 'NoStamp', 'infra', 0, 'active', ?, ?, ?, 0, 0)`).run(NOW, NOW, FUTURE);
}

let db;

beforeEach(() => {
  db = createTestDb();
  seedTeamTestData(db);

  // Monkey-patch the database module so getDb returns our test DB
  const database = require('../src/database');
  database._origGetDb = database.getDb;
  database.getDb = () => db;
});

afterEach(() => {
  // Restore original getDb
  const database = require('../src/database');
  if (database._origGetDb) {
    database.getDb = database._origGetDb;
    delete database._origGetDb;
  }
  if (db) db.close();
});

describe('computeTeamReputation', () => {
  it('computes aggregate score for a 3-member team', () => {
    const { computeTeamReputation } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t1', 'Alpha', '0xAAA')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m1', 't1', 'agent1', 'owner')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m2', 't1', 'agent2', 'member')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m3', 't1', 'agent3', 'member')`).run();

    const result = computeTeamReputation('t1');

    expect(result.member_count).toBe(3);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.label).toBeDefined();
    expect(result.members).toHaveLength(3);
    expect(result.coverage_bonus).toBe(1.0);
    expect(result.mean_score).toBeGreaterThan(0);
  });

  it('applies weakest link factor when a member scores below 10', () => {
    const { computeTeamReputation } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t2', 'Weak', '0xAAA')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m4', 't2', 'agent1', 'owner')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m5', 't2', 'agent4', 'member')`).run();

    const result = computeTeamReputation('t2');

    expect(result.weakest_link_applied).toBe(true);
    expect(result.weakest_member).toBeDefined();
    expect(result.weakest_member.agent_id).toBe('agent4');
  });

  it('returns zero score for empty team', () => {
    const { computeTeamReputation } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t3', 'Empty', '0xAAA')`).run();

    const result = computeTeamReputation('t3');

    expect(result.score).toBe(0);
    expect(result.member_count).toBe(0);
    expect(result.label).toBe('new');
    expect(result.members).toHaveLength(0);
  });

  it('returns immutable result', () => {
    const { computeTeamReputation } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t4', 'Frozen', '0xAAA')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m6', 't4', 'agent1', 'owner')`).run();

    const result = computeTeamReputation('t4');

    expect(Object.isFrozen(result)).toBe(true);
    expect(() => { result.score = 999; }).toThrow();
  });

  it('includes correct member roles', () => {
    const { computeTeamReputation } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t5', 'Roles', '0xAAA')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m7', 't5', 'agent1', 'owner')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m8', 't5', 'agent2', 'member')`).run();

    const result = computeTeamReputation('t5');

    const owner = result.members.find(m => m.agent_id === 'agent1');
    expect(owner.role).toBe('owner');
    const member = result.members.find(m => m.agent_id === 'agent2');
    expect(member.role).toBe('member');
  });

  it('coverage bonus increases above floor', () => {
    const { computeTeamReputation } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t6', 'Big', '0xAAA')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m9', 't6', 'agent1', 'owner')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m10', 't6', 'agent2', 'member')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m11', 't6', 'agent3', 'member')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m12', 't6', 'agent4', 'member')`).run();

    const result = computeTeamReputation('t6');

    expect(result.coverage_bonus).toBe(1.02); // 4 members = 1 above floor of 3
    expect(result.member_count).toBe(4);
  });

  it('handles nonexistent team', () => {
    const { computeTeamReputation } = require('../src/reputation');

    const result = computeTeamReputation('nonexistent');
    expect(result.score).toBe(0);
    expect(result.member_count).toBe(0);
  });

  it('labels match getLabel function', () => {
    const { computeTeamReputation, getLabel } = require('../src/reputation');

    db.prepare(`INSERT INTO teams (id, name, owner_wallet) VALUES ('t7', 'Labels', '0xAAA')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m13', 't7', 'agent1', 'owner')`).run();
    db.prepare(`INSERT INTO team_members (id, team_id, agent_id, role) VALUES ('m14', 't7', 'agent2', 'member')`).run();

    const result = computeTeamReputation('t7');
    expect(result.label).toBe(getLabel(result.score));
  });

  it('TEAM_MAX_MEMBERS is 20', () => {
    const { TEAM_MAX_MEMBERS } = require('../src/reputation');
    expect(TEAM_MAX_MEMBERS).toBe(20);
  });
});
