/**
 * Reputation Monitor — detects when an agent's reputation score
 * changes by >= REPUTATION_CHANGE_THRESHOLD points and dispatches
 * a reputation_changed webhook + event log entry.
 *
 * Uses lazy require() to avoid circular dependencies with database,
 * reputation, eventLog, and webhookDispatcher modules.
 */

const REPUTATION_CHANGE_THRESHOLD = 5;

/**
 * Check whether an agent's reputation has changed significantly
 * since its last recorded score. If so, log an event and fire a webhook.
 *
 * @param {string} agentId
 * @returns {{ changed: boolean, delta: number, previous_score: number|null, new_score: number } | null}
 *   null when the agent does not exist
 */
function checkAndDispatchReputationChange(agentId) {
  // Lazy requires to avoid circular deps
  const { getDb } = require('./database');
  const { computeReputation, getLabel } = require('./reputation');
  const { appendEvent } = require('./eventLog');
  const { dispatch } = require('./webhookDispatcher');

  const db = getDb();
  const agent = db.prepare(
    'SELECT id, wallet_address, last_reputation_score FROM agents WHERE id = ?'
  ).get(agentId);

  if (!agent) return null;

  const reputation = computeReputation(agentId);
  if (!reputation) return null;

  const newScore = reputation.score;
  const previousScore = agent.last_reputation_score;

  // Always persist the latest score (immutable-style: write new value, don't mutate in-memory)
  db.prepare('UPDATE agents SET last_reputation_score = ? WHERE id = ?')
    .run(newScore, agentId);

  // First time — just store, don't alert
  if (previousScore === null) {
    return Object.freeze({
      changed: false,
      delta: 0,
      previous_score: null,
      new_score: newScore,
    });
  }

  const delta = newScore - previousScore;
  const changed = Math.abs(delta) >= REPUTATION_CHANGE_THRESHOLD;

  if (changed) {
    const labelChanged = getLabel(newScore) !== getLabel(previousScore);

    appendEvent('reputation_changed', {
      agent_id: agentId,
      wallet_address: agent.wallet_address,
      previous_score: previousScore,
      new_score: newScore,
      delta,
    });

    dispatch(agent.wallet_address, 'reputation_changed', {
      agent_id: agentId,
      wallet_address: agent.wallet_address,
      previous_score: previousScore,
      new_score: newScore,
      delta,
      label_changed: labelChanged,
    });
  }

  return Object.freeze({
    changed,
    delta,
    previous_score: previousScore,
    new_score: newScore,
  });
}

module.exports = { checkAndDispatchReputationChange, REPUTATION_CHANGE_THRESHOLD };
