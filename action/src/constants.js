const TIER_ORDER = Object.freeze({
  none: 0,
  free: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
});

const TIER_COLORS = Object.freeze({
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  free: '#4CAF50',
  none: '#9E9E9E',
});

const DEFAULT_API_BASE = 'https://agentstamp.org';
const API_TIMEOUT_MS = 10_000;
const USER_AGENT = 'agentstamp-verify-action/1.0.0';

module.exports = {
  TIER_ORDER,
  TIER_COLORS,
  DEFAULT_API_BASE,
  API_TIMEOUT_MS,
  USER_AGENT,
};
