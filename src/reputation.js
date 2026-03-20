const { getDb } = require('./database');

/**
 * Reputation Score (0-100) formula:
 *
 * score = clamp(0, 100, tier + endorsements + decayedUptime + momentum + wishes - penalty)
 *
 * tier_score        = { bronze: 10, silver: 20, gold: 30 }       (max 30)
 * endorsement_score = min(endorsement_count * 5, 30)              (max 30)
 * uptime_score      = uptime_percentage * 0.20 * decay            (max 20)
 * momentum_score    = cold-start actions in first 30 days         (max 15)
 * wish_score        = min(wishes_granted * 2, 5)                  (max  5)
 *
 * Labels: 0-25 "new", 26-50 "emerging", 51-75 "established", 76-100 "elite"
 */

const TIER_SCORES = { free: 5, bronze: 10, silver: 20, gold: 30 };

// ─── Trust Score Decay ──────────────────────────────────────────────────────

const DECAY_GRACE_DAYS = 3;
const DECAY_TIERS = [
  { maxDays: 3, multiplier: 1.0 },
  { maxDays: 7, multiplier: 0.75 },
  { maxDays: 14, multiplier: 0.50 },
  { maxDays: 30, multiplier: 0.25 },
];
const DECAY_PENALTY_PER_DAY = 0.5;
const DECAY_PENALTY_MAX = 15;
const MS_PER_DAY = 86400000;

/**
 * Compute decay info for an agent based on heartbeat recency.
 * Pure function — returns a new immutable object, never mutates input.
 * @param {object} agent - Agent row (must have last_heartbeat and registered_at)
 * @returns {{ days_since_heartbeat: number, decay_multiplier: number, penalty: number }}
 */
function computeDecayInfo(agent) {
  const last = agent.last_heartbeat || agent.registered_at;
  const rawDays = (Date.now() - new Date(last).getTime()) / MS_PER_DAY;
  const daysSinceHeartbeat = Number.isFinite(rawDays) ? rawDays : 0;

  let decayMultiplier = 0;
  for (const tier of DECAY_TIERS) {
    if (daysSinceHeartbeat <= tier.maxDays) {
      decayMultiplier = tier.multiplier;
      break;
    }
  }

  const penalty = daysSinceHeartbeat <= DECAY_GRACE_DAYS
    ? 0
    : Math.min((daysSinceHeartbeat - DECAY_GRACE_DAYS) * DECAY_PENALTY_PER_DAY, DECAY_PENALTY_MAX);

  return Object.freeze({
    days_since_heartbeat: Math.round(daysSinceHeartbeat * 100) / 100,
    decay_multiplier: decayMultiplier,
    penalty: Math.round(penalty * 100) / 100,
  });
}

// ─── Cold-Start Momentum ────────────────────────────────────────────────────

const MOMENTUM_MAX = 15;
const MOMENTUM_DECAY_START_DAYS = 30;
const MOMENTUM_DECAY_END_DAYS = 60;
const MOMENTUM_ACTIONS = {
  FIRST_HEARTBEAT_WITHIN_1H: 3,
  FIRST_ENDORSEMENT_WITHIN_24H: 3,
  THREE_HEARTBEATS_FIRST_WEEK: 3,
  FIRST_STAMP_EVENT: 3,
  SEVEN_CONSECUTIVE_DAYS: 3,
};

/**
 * Check if a sorted array of date strings (YYYY-MM-DD) contains
 * at least 7 consecutive calendar days.
 * @param {string[]} sortedDates - unique date strings sorted ascending
 * @returns {boolean}
 */
function hasSevenConsecutiveDays(sortedDates) {
  if (sortedDates.length < 7) return false;

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00Z');
    const curr = new Date(sortedDates[i] + 'T00:00:00Z');
    const diffDays = (curr - prev) / MS_PER_DAY;

    if (diffDays === 1) {
      streak += 1;
      if (streak >= 7) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

/**
 * Compute cold-start momentum score for an agent.
 * Rewards agents for being active in their first 30 days, then decays to 0 by day 60.
 * Pure function — returns a new immutable object, never mutates input.
 *
 * @param {object} agent - Agent row (must have id, wallet_address, registered_at)
 * @param {object} db - Database handle (better-sqlite3 instance)
 * @returns {{ earned: number, effective: number, actions: string[], decayed: boolean }}
 */
function computeMomentum(agent, db) {
  const actions = [];
  let earned = 0;

  // 1. First heartbeat within 1 hour of registration
  // Use datetime() on both sides to normalize ISO 8601 (with T/Z) to SQLite format
  const hb1h = db.prepare(
    "SELECT 1 FROM heartbeat_log WHERE agent_id = ? AND datetime(recorded_at) <= datetime(?, '+1 hour') LIMIT 1"
  ).get(agent.id, agent.registered_at);
  if (hb1h) {
    earned += MOMENTUM_ACTIONS.FIRST_HEARTBEAT_WITHIN_1H;
    actions.push('FIRST_HEARTBEAT_WITHIN_1H');
  }

  // 2. First endorsement within 24 hours
  const end24h = db.prepare(
    "SELECT 1 FROM endorsements WHERE agent_id = ? AND datetime(created_at) <= datetime(?, '+1 day') LIMIT 1"
  ).get(agent.id, agent.registered_at);
  if (end24h) {
    earned += MOMENTUM_ACTIONS.FIRST_ENDORSEMENT_WITHIN_24H;
    actions.push('FIRST_ENDORSEMENT_WITHIN_24H');
  }

  // 3. Three heartbeats in the first week
  const hbWeek = db.prepare(
    "SELECT COUNT(*) as cnt FROM heartbeat_log WHERE agent_id = ? AND datetime(recorded_at) <= datetime(?, '+7 days')"
  ).get(agent.id, agent.registered_at);
  if (hbWeek && hbWeek.cnt >= 3) {
    earned += MOMENTUM_ACTIONS.THREE_HEARTBEATS_FIRST_WEEK;
    actions.push('THREE_HEARTBEATS_FIRST_WEEK');
  }

  // 4. First stamp event (any time)
  const stampEvt = db.prepare(
    "SELECT 1 FROM stamp_events WHERE wallet_address = ? LIMIT 1"
  ).get(agent.wallet_address);
  if (stampEvt) {
    earned += MOMENTUM_ACTIONS.FIRST_STAMP_EVENT;
    actions.push('FIRST_STAMP_EVENT');
  }

  // 5. Seven consecutive days of heartbeats within first 14 days
  const hbDates = db.prepare(
    "SELECT DISTINCT date(recorded_at) as d FROM heartbeat_log WHERE agent_id = ? AND datetime(recorded_at) <= datetime(?, '+14 days') ORDER BY d"
  ).all(agent.id, agent.registered_at);
  const dateStrings = hbDates.map(r => r.d);
  if (hasSevenConsecutiveDays(dateStrings)) {
    earned += MOMENTUM_ACTIONS.SEVEN_CONSECUTIVE_DAYS;
    actions.push('SEVEN_CONSECUTIVE_DAYS');
  }

  // Cap at MOMENTUM_MAX
  const capped = Math.min(earned, MOMENTUM_MAX);

  // Apply decay after MOMENTUM_DECAY_START_DAYS
  const registeredAt = new Date(agent.registered_at);
  const daysRegistered = Math.max(0, (Date.now() - registeredAt.getTime()) / MS_PER_DAY);

  let effective = capped;
  let decayed = false;

  if (daysRegistered > MOMENTUM_DECAY_START_DAYS) {
    decayed = true;
    const decayFactor = Math.max(
      0,
      1 - (daysRegistered - MOMENTUM_DECAY_START_DAYS) / (MOMENTUM_DECAY_END_DAYS - MOMENTUM_DECAY_START_DAYS)
    );
    effective = Math.round(capped * decayFactor * 100) / 100;
  }

  return Object.freeze({
    earned: capped,
    effective,
    actions,
    decayed,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLabel(score) {
  if (score <= 25) return 'new';
  if (score <= 50) return 'emerging';
  if (score <= 75) return 'established';
  return 'elite';
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute uptime percentage based on heartbeat frequency.
 * Uptime is measured as: (heartbeats received / expected heartbeats) over the agent's lifetime.
 * Expected: ~1 heartbeat per day since registration.
 */
function computeUptimePercent(agent) {
  const registeredAt = new Date(agent.registered_at);
  const now = new Date();
  const daysSinceRegistration = Math.max(1, (now - registeredAt) / (1000 * 60 * 60 * 24));
  const expectedHeartbeats = Math.ceil(daysSinceRegistration);
  const actualHeartbeats = agent.heartbeat_count || 0;

  if (expectedHeartbeats === 0) return 100;
  return Math.min(100, (actualHeartbeats / expectedHeartbeats) * 100);
}

/**
 * Compute the full reputation breakdown for an agent.
 * @param {string} agentId
 * @returns {{ score: number, label: string, breakdown: object, factors: object } | null}
 */
function computeReputation(agentId) {
  const db = getDb();

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return null;

  // Get stamp tier
  let stampTier = null;
  if (agent.stamp_id) {
    const stamp = db.prepare('SELECT tier FROM stamps WHERE id = ? AND revoked = 0').get(agent.stamp_id);
    if (stamp) stampTier = stamp.tier;
  }

  // Count wishes granted by this agent's wallet
  const wishesGranted = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE granted_by = ?"
  ).get(agent.wallet_address)?.count || 0;

  // Calculate each factor
  const tierScore = TIER_SCORES[stampTier] || 0;
  const endorsementScore = Math.min((agent.endorsement_count || 0) * 5, 30);

  const uptimePercent = computeUptimePercent(agent);
  const uptimeScore = uptimePercent * 0.20;

  const wishScore = Math.min(wishesGranted * 2, 5);

  // Apply trust score decay based on heartbeat recency
  const decayInfo = computeDecayInfo(agent);
  const decayedUptimeScore = uptimeScore * decayInfo.decay_multiplier;

  // Compute cold-start momentum (replaces age_score)
  const momentum = computeMomentum(agent, db);

  const rawScore = tierScore + endorsementScore + decayedUptimeScore + momentum.effective + wishScore - decayInfo.penalty;
  const score = clamp(0, 100, Math.round(rawScore));

  return {
    score,
    label: getLabel(score),
    breakdown: {
      tier: Math.round(tierScore),
      endorsements: Math.round(endorsementScore),
      uptime: Math.round(decayedUptimeScore * 10) / 10,
      momentum: Math.round(momentum.effective * 10) / 10,
      wishes: Math.round(wishScore),
      decay_info: decayInfo,
    },
    factors: {
      stamp_tier: stampTier || 'none',
      endorsement_count: agent.endorsement_count || 0,
      uptime_percent: Math.round(uptimePercent * 10) / 10,
      days_registered: Math.round(
        Math.max(0, (Date.now() - new Date(agent.registered_at).getTime()) / MS_PER_DAY)
      ),
      heartbeat_count: agent.heartbeat_count || 0,
      wishes_granted: wishesGranted,
      momentum_details: momentum,
    },
    max_possible: {
      tier: 30,
      endorsements: 30,
      uptime: 20,
      momentum: 15,
      wishes: 5,
    },
  };
}

function getScoreRange(score) {
  if (score <= 25) return '0-25';
  if (score <= 50) return '26-50';
  if (score <= 75) return '51-75';
  return '76-100';
}

// ─── Trust Delegation Bonus ─────────────────────────────────────────────────

const DELEGATION_MIN_SCORE = 50;
const DELEGATION_MAX_OUTGOING = 5;
const DELEGATION_MAX_DAYS = 30;
const DELEGATION_BONUS_CAP = 20;
const DELEGATION_WEIGHT_FACTOR = 0.15;

/**
 * Compute the delegation bonus for a wallet based on active incoming delegations.
 * Uses the delegator's last_reputation_score to avoid recursive computation.
 * Pure function — returns an immutable object.
 *
 * @param {string} walletAddress - The delegatee wallet (primary resolved)
 * @param {object} db - Database handle (better-sqlite3 instance)
 * @returns {{ bonus: number, delegations: Array<{delegator_wallet: string, weight: number, score: number, contribution: number}> }}
 */
function computeDelegationBonus(walletAddress, db) {
  const activeDelegations = db.prepare(
    "SELECT * FROM trust_delegations WHERE delegatee_wallet = ? AND expires_at > datetime('now')"
  ).all(walletAddress);

  const delegations = [];
  let totalBonus = 0;

  for (const del of activeDelegations) {
    const delegatorAgent = db.prepare(
      "SELECT last_reputation_score FROM agents WHERE wallet_address = ? AND status = 'active' ORDER BY registered_at ASC LIMIT 1"
    ).get(del.delegator_wallet);

    const delegatorScore = delegatorAgent?.last_reputation_score || 0;
    const contribution = Math.round(delegatorScore * del.weight * DELEGATION_WEIGHT_FACTOR * 100) / 100;
    totalBonus += contribution;

    delegations.push(Object.freeze({
      delegator_wallet: del.delegator_wallet,
      weight: del.weight,
      score: delegatorScore,
      contribution,
    }));
  }

  const cappedBonus = Math.min(Math.round(totalBonus * 100) / 100, DELEGATION_BONUS_CAP);

  return Object.freeze({
    bonus: cappedBonus,
    delegations,
  });
}

module.exports = {
  computeReputation,
  computeDecayInfo,
  computeMomentum,
  getLabel,
  getScoreRange,
  computeDelegationBonus,
  DELEGATION_MIN_SCORE,
  DELEGATION_MAX_OUTGOING,
  DELEGATION_MAX_DAYS,
  DELEGATION_BONUS_CAP,
  DELEGATION_WEIGHT_FACTOR,
};
