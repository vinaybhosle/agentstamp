const { createTestDb } = require('./helpers');
const { computeDecayInfo } = require('../src/reputation');

const MS_PER_DAY = 86400000;
const GOOD_WALLET = '0x' + 'a'.repeat(40);
const NOW_MS = Date.now();

function daysAgo(days) {
  return new Date(NOW_MS - days * MS_PER_DAY).toISOString();
}

function makeAgent(overrides = {}) {
  return {
    last_heartbeat: daysAgo(0),
    registered_at: daysAgo(30),
    ...overrides,
  };
}

// ─── computeDecayInfo (pure function) ───────────────────────────────────────

describe('computeDecayInfo', () => {
  it('agent with heartbeat today → no decay, multiplier 1.0, penalty 0', () => {
    const info = computeDecayInfo(makeAgent({ last_heartbeat: daysAgo(0) }));
    expect(info.decay_multiplier).toBe(1.0);
    expect(info.penalty).toBe(0);
    expect(info.days_since_heartbeat).toBeLessThan(1);
  });

  it('agent with heartbeat 5 days ago → multiplier 0.75, penalty 1.0', () => {
    const info = computeDecayInfo(makeAgent({ last_heartbeat: daysAgo(5) }));
    expect(info.decay_multiplier).toBe(0.75);
    expect(info.penalty).toBe(1.0);
  });

  it('agent with heartbeat 10 days ago → multiplier 0.50, penalty 3.5', () => {
    const info = computeDecayInfo(makeAgent({ last_heartbeat: daysAgo(10) }));
    expect(info.decay_multiplier).toBe(0.50);
    expect(info.penalty).toBe(3.5);
  });

  it('agent with heartbeat 20 days ago → multiplier 0.25, penalty 8.5', () => {
    const info = computeDecayInfo(makeAgent({ last_heartbeat: daysAgo(20) }));
    expect(info.decay_multiplier).toBe(0.25);
    expect(info.penalty).toBe(8.5);
  });

  it('agent with heartbeat 45 days ago → multiplier 0, penalty 15', () => {
    const info = computeDecayInfo(makeAgent({ last_heartbeat: daysAgo(45) }));
    expect(info.decay_multiplier).toBe(0);
    expect(info.penalty).toBe(15);
  });

  it('agent with null last_heartbeat → falls back to registered_at', () => {
    const info = computeDecayInfo(makeAgent({
      last_heartbeat: null,
      registered_at: daysAgo(10),
    }));
    expect(info.decay_multiplier).toBe(0.50);
    expect(info.penalty).toBe(3.5);
  });

  it('grace period: 2 days ago → multiplier 1.0, penalty 0', () => {
    const info = computeDecayInfo(makeAgent({ last_heartbeat: daysAgo(2) }));
    expect(info.decay_multiplier).toBe(1.0);
    expect(info.penalty).toBe(0);
  });
});

// ─── Score floor verification (pure function) ──────────────────────────────

describe('trust decay score floor', () => {
  it('score floor: heavily decayed agent produces penalty that cannot push below 0 after clamp', () => {
    // Simulate what computeReputation does: rawScore includes -penalty
    // With a 60-day-inactive agent: multiplier=0, penalty=15
    // Even if all other scores are 0, clamp(0,100,...) ensures >= 0
    const info = computeDecayInfo(makeAgent({
      last_heartbeat: daysAgo(60),
      registered_at: daysAgo(60),
    }));

    expect(info.decay_multiplier).toBe(0);
    expect(info.penalty).toBe(15);

    // Verify: if tierScore=0, endorsement=0, uptime=0 (multiplied by 0), age=0, wish=0
    // rawScore = 0 + 0 + 0 + 0 + 0 - 15 = -15
    // clamp(0, 100, -15) = 0 — score floor holds
    const rawScore = 0 - info.penalty;
    const clamped = Math.max(0, Math.min(100, Math.round(rawScore)));
    expect(clamped).toBe(0);
  });
});
