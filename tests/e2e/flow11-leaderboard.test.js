/**
 * Flow 11 — Enhanced Leaderboard
 *
 * Tests the live leaderboard endpoint including response structure,
 * network stats, filter parameters, and limit capping.
 *
 * GET /registry/leaderboard/live → verify structure
 * Test filters: ?category=data, ?trusted_only=true, ?sort=endorsements
 * Verify limit caps at 50
 */

const { get } = require('./helpers');

describe('Flow 11 — Enhanced Leaderboard', () => {
  // ── Step 1: GET /registry/leaderboard/live — base response structure ───────
  describe('Step 1: GET /api/v1/registry/leaderboard/live — base response', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live');
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(res.body.success).toBe(true);
    });

    it('has agents array', () => {
      expect(Array.isArray(res.body.agents)).toBe(true);
    });

    it('has trending array', () => {
      expect(Array.isArray(res.body.trending)).toBe(true);
    });

    it('has network object', () => {
      expect(res.body.network).toBeDefined();
      expect(typeof res.body.network).toBe('object');
    });

    it('network has total_agents (number)', () => {
      expect(typeof res.body.network.total_agents).toBe('number');
      expect(res.body.network.total_agents).toBeGreaterThanOrEqual(0);
    });

    it('network has average_score (number)', () => {
      expect(typeof res.body.network.average_score).toBe('number');
    });

    it('network has active_percent (number)', () => {
      expect(typeof res.body.network.active_percent).toBe('number');
    });

    it('network has total_delegations (number)', () => {
      expect(typeof res.body.network.total_delegations).toBe('number');
    });

    it('network has total_stamps (number)', () => {
      expect(typeof res.body.network.total_stamps).toBe('number');
    });
  });

  // ── Step 2: Agents in leaderboard have correct fields ─────────────────────
  describe('Step 2: Agent entries have required fields', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live');
    });

    it('each agent has id, name, category fields', () => {
      if (res.body.agents.length === 0) {
        // No agents registered yet — skip structural checks
        return;
      }
      const agent = res.body.agents[0];
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.category).toBeTruthy();
    });

    it('each agent has a reputation object with score and label', () => {
      if (res.body.agents.length === 0) return;
      const agent = res.body.agents[0];
      expect(agent.reputation).toBeDefined();
      expect(typeof agent.reputation.score).toBe('number');
      expect(agent.reputation.label).toBeTruthy();
    });

    it('each agent has score_trend field', () => {
      if (res.body.agents.length === 0) return;
      const agent = res.body.agents[0];
      expect(['rising', 'stable', 'falling']).toContain(agent.score_trend);
    });

    it('each agent has delegations_received field', () => {
      if (res.body.agents.length === 0) return;
      const agent = res.body.agents[0];
      expect(typeof agent.delegations_received).toBe('number');
    });

    it('agents are sorted by score descending (default)', () => {
      const agents = res.body.agents;
      if (agents.length < 2) return;
      for (let i = 0; i < agents.length - 1; i++) {
        expect(agents[i].reputation.score).toBeGreaterThanOrEqual(
          agents[i + 1].reputation.score
        );
      }
    });
  });

  // ── Step 3: Filter by category ────────────────────────────────────────────
  describe('Step 3: GET /api/v1/registry/leaderboard/live?category=data', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live?category=data');
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('all agents in result have category=data', () => {
      for (const agent of res.body.agents) {
        expect(agent.category).toBe('data');
      }
    });
  });

  // ── Step 4: Filter by trusted_only=true ───────────────────────────────────
  describe('Step 4: GET /api/v1/registry/leaderboard/live?trusted_only=true', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live?trusted_only=true');
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('all returned agents have score >= 10', () => {
      for (const agent of res.body.agents) {
        expect(agent.reputation.score).toBeGreaterThanOrEqual(10);
      }
    });
  });

  // ── Step 5: Sort by endorsements ─────────────────────────────────────────
  describe('Step 5: GET /api/v1/registry/leaderboard/live?sort=endorsements', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live?sort=endorsements');
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('agents sorted by endorsement_count descending', () => {
      const agents = res.body.agents;
      if (agents.length < 2) return;
      for (let i = 0; i < agents.length - 1; i++) {
        expect(agents[i].endorsement_count).toBeGreaterThanOrEqual(
          agents[i + 1].endorsement_count
        );
      }
    });
  });

  // ── Step 6: Limit capped at 50 ────────────────────────────────────────────
  describe('Step 6: GET /api/v1/registry/leaderboard/live?limit=100 is capped at 50', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live?limit=100');
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('agents array has at most 50 entries', () => {
      expect(res.body.agents.length).toBeLessThanOrEqual(50);
    });
  });

  // ── Step 7: Sort by newest ────────────────────────────────────────────────
  describe('Step 7: GET /api/v1/registry/leaderboard/live?sort=newest', () => {
    let res;

    beforeAll(async () => {
      res = await get('/api/v1/registry/leaderboard/live?sort=newest');
    });

    it('returns HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('agents sorted by registered_at descending', () => {
      const agents = res.body.agents;
      if (agents.length < 2) return;
      for (let i = 0; i < agents.length - 1; i++) {
        const dateA = new Date(agents[i].registered_at).getTime();
        const dateB = new Date(agents[i + 1].registered_at).getTime();
        expect(dateA).toBeGreaterThanOrEqual(dateB);
      }
    });
  });
});
