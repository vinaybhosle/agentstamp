/**
 * Shared constants used across multiple modules.
 * Single source of truth — prevents drift between route handlers.
 */

const AI_ACT_RISK_LEVELS = Object.freeze(['minimal', 'limited', 'high']);

const AGENT_CATEGORIES = Object.freeze([
  'data', 'trading', 'research', 'creative', 'infrastructure', 'other',
]);

const TRANSPARENCY_ALLOWED_KEYS = Object.freeze([
  'purpose', 'model_provider', 'training_data', 'human_oversight', 'data_retention',
]);

const TRANSPARENCY_MAX_BYTES = 2000;
const HUMAN_SPONSOR_MAX_LEN = 200;

module.exports = {
  AI_ACT_RISK_LEVELS,
  AGENT_CATEGORIES,
  TRANSPARENCY_ALLOWED_KEYS,
  TRANSPARENCY_MAX_BYTES,
  HUMAN_SPONSOR_MAX_LEN,
};
