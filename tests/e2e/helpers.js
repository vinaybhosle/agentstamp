/**
 * E2E test helpers — shared utilities for live-API integration tests.
 *
 * Tests hit http://localhost:4005 directly (server-side fetch bypasses CORS).
 * Each test suite generates its own unique wallet so the 7-day / 30-day
 * cooldowns never collide between runs.
 */

const { randomBytes } = require('crypto');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4005';

/**
 * Generate a valid EVM wallet address that starts with the `0xe2e` prefix
 * so the afterAll cleanup SQL can target exactly test-created rows.
 */
function makeTestWallet() {
  // 0x  + "e2e" marker (3 hex chars) + 37 random hex chars = 40 hex total
  const random = randomBytes(20).toString('hex').slice(0, 37);
  return `0xe2e${random}`;
}

/**
 * Thin wrapper around fetch that sets the Origin header so Helmet / CORS
 * passes the request through when CORS_ORIGIN is configured, and always
 * sends JSON.
 */
async function api(method, path, { headers = {}, body } = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.CORS_ORIGIN || 'https://agentstamp.org',
      ...headers,
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);

  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, body: json };
}

// Convenience shorthands
const get = (path, opts) => api('GET', path, opts);
const post = (path, opts) => api('POST', path, opts);
const put = (path, opts) => api('PUT', path, opts);
const del = (path, opts) => api('DELETE', path, opts);

module.exports = { BASE_URL, makeTestWallet, api, get, post, put, del };
