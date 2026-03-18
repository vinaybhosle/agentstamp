const { getDb } = require('./database');

/**
 * Reputation Score (0-100) formula:
 *
 * score = clamp(0, 100, tier + endorsements + uptime + age + wishes)
 *
 * tier_score        = { bronze: 10, silver: 20, gold: 30 }       (max 30)
 * endorsement_score = min(endorsement_count * 5, 30)              (max 30)
 * uptime_score      = uptime_percentage * 0.20                    (max 20)
 * age_score         = min(days_registered / 7, 10)                (max 10)
 * wish_score        = min(wishes_granted * 2, 10)                 (max 10)
 *
 * Labels: 0-25 "new", 26-50 "emerging", 51-75 "established", 76-100 "elite"
 */

const TIER_SCORES = { free: 5, bronze: 10, silver: 20, gold: 30 };

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

  const registeredAt = new Date(agent.registered_at);
  const daysRegistered = Math.max(0, (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60 * 24));
  const ageScore = Math.min(daysRegistered / 7, 10);

  const wishScore = Math.min(wishesGranted * 2, 10);

  const rawScore = tierScore + endorsementScore + uptimeScore + ageScore + wishScore;
  const score = clamp(0, 100, Math.round(rawScore));

  return {
    score,
    label: getLabel(score),
    breakdown: {
      tier: Math.round(tierScore),
      endorsements: Math.round(endorsementScore),
      uptime: Math.round(uptimeScore * 10) / 10,
      age: Math.round(ageScore * 10) / 10,
      wishes: Math.round(wishScore),
    },
    factors: {
      stamp_tier: stampTier || 'none',
      endorsement_count: agent.endorsement_count || 0,
      uptime_percent: Math.round(uptimePercent * 10) / 10,
      days_registered: Math.round(daysRegistered),
      heartbeat_count: agent.heartbeat_count || 0,
      wishes_granted: wishesGranted,
    },
    max_possible: {
      tier: 30,
      endorsements: 30,
      uptime: 20,
      age: 10,
      wishes: 10,
    },
  };
}

module.exports = { computeReputation, getLabel };
