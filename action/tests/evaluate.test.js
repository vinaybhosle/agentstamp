import { describe, it, expect } from 'vitest';
const { evaluateThresholds } = require('../src/evaluate');

const makeResponse = (overrides = {}) => ({
  trusted: true,
  score: 75,
  tier: 'gold',
  label: 'established',
  agent: { id: 'a1', name: 'TestAgent', endorsements: 5 },
  stamp: { id: 's1', tier: 'gold', expires_at: '2026-04-01' },
  ...overrides,
});

describe('evaluateThresholds', () => {
  it('passes when all thresholds met', () => {
    const result = evaluateThresholds(makeResponse(), {
      minTier: 'bronze',
      minScore: 50,
      minEndorsements: 3,
    });
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('fails when agent is not trusted', () => {
    const result = evaluateThresholds(makeResponse({ trusted: false }), {
      minTier: 'none',
      minScore: 0,
      minEndorsements: 0,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('Agent is not trusted by AgentStamp');
  });

  it('fails when tier is below minimum', () => {
    const result = evaluateThresholds(makeResponse({ tier: 'free' }), {
      minTier: 'gold',
      minScore: 0,
      minEndorsements: 0,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/tier.*free.*below.*gold/i);
  });

  it('passes when tier equals minimum', () => {
    const result = evaluateThresholds(makeResponse({ tier: 'silver' }), {
      minTier: 'silver',
      minScore: 0,
      minEndorsements: 0,
    });
    expect(result.passed).toBe(true);
  });

  it('fails when score is below minimum', () => {
    const result = evaluateThresholds(makeResponse({ score: 30 }), {
      minTier: 'none',
      minScore: 50,
      minEndorsements: 0,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/score.*30.*below.*50/i);
  });

  it('passes when score equals minimum', () => {
    const result = evaluateThresholds(makeResponse({ score: 50 }), {
      minTier: 'none',
      minScore: 50,
      minEndorsements: 0,
    });
    expect(result.passed).toBe(true);
  });

  it('fails when endorsements are below minimum', () => {
    const result = evaluateThresholds(
      makeResponse({ agent: { endorsements: 2 } }),
      { minTier: 'none', minScore: 0, minEndorsements: 5 }
    );
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/endorsements.*2.*below.*5/i);
  });

  it('reports multiple failures', () => {
    const result = evaluateThresholds(
      makeResponse({ trusted: false, score: 10, tier: 'free' }),
      { minTier: 'gold', minScore: 50, minEndorsements: 0 }
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.length).toBe(3);
  });

  it('handles null agent gracefully for endorsements', () => {
    const result = evaluateThresholds(makeResponse({ agent: null }), {
      minTier: 'none',
      minScore: 0,
      minEndorsements: 1,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/endorsements.*0.*below.*1/i);
  });

  it('passes with min-tier none and tier none', () => {
    const result = evaluateThresholds(
      makeResponse({ tier: 'none' }),
      { minTier: 'none', minScore: 0, minEndorsements: 0 }
    );
    expect(result.passed).toBe(true);
  });
});
