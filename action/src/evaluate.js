const { TIER_ORDER } = require('./constants');

/**
 * Evaluate trust check response against thresholds.
 * @param {object} response - Trust check API response
 * @param {object} thresholds - { minTier, minScore, minEndorsements }
 * @returns {{ passed: boolean, reasons: string[] }}
 */
function evaluateThresholds(response, thresholds) {
  const reasons = [];
  const { minTier, minScore, minEndorsements } = thresholds;

  if (!response.trusted) {
    reasons.push('Agent is not trusted by AgentStamp');
  }

  const actualTierRank = TIER_ORDER[response.tier] ?? 0;
  const requiredTierRank = TIER_ORDER[minTier] ?? 0;
  if (actualTierRank < requiredTierRank) {
    reasons.push(
      `Stamp tier '${response.tier || 'none'}' is below required '${minTier}'`
    );
  }

  const actualScore = response.score ?? 0;
  if (actualScore < minScore) {
    reasons.push(
      `Reputation score ${actualScore} is below required ${minScore}`
    );
  }

  const actualEndorsements = response.agent?.endorsements ?? 0;
  if (actualEndorsements < minEndorsements) {
    reasons.push(
      `Endorsements ${actualEndorsements} is below required ${minEndorsements}`
    );
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

module.exports = { evaluateThresholds };
