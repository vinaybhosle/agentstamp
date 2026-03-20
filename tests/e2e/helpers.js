/**
 * E2E test helpers — shared utilities for live-API integration tests.
 *
 * Tests hit http://localhost:4005 directly (server-side fetch bypasses CORS).
 * Each test suite generates its own unique wallet so the 7-day / 30-day
 * cooldowns never collide between runs.
 *
 * Signature support: use makeSignedWallet() to get a keypair that can produce
 * valid x-wallet-signature headers for mutation endpoints hardened post 2026-03-20.
 */

const { randomBytes } = require('crypto');
const { Wallet } = require('ethers');
const { buildSignatureMessage, hashRequestBody } = require('../../src/walletAuth');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4005';

/**
 * Generate a valid EVM wallet address that starts with the `0xe2e` prefix
 * so the afterAll cleanup SQL can target exactly test-created rows.
 *
 * Returns only the address string — no signing capability.
 */
function makeTestWallet() {
  // 0x  + "e2e" marker (3 hex chars) + 37 random hex chars = 40 hex total
  const random = randomBytes(20).toString('hex').slice(0, 37);
  return `0xe2e${random}`;
}

/**
 * Generate a real ethers Wallet for use in E2E tests.
 *
 * Uses a random private key directly so there is no address-prefix brute-force
 * loop (which takes 4000+ iterations for the 0xe2e prefix).  The wallet is
 * uniquely identifiable via the `_e2e_` marker embedded in test payloads.
 *
 * The wallet can produce valid EVM signatures for mutation endpoints.
 * Use wallet.address for the x-wallet-address header and
 * wallet.signHeaders(action, body?) to get { 'x-wallet-signature', 'x-wallet-timestamp' }.
 */
function makeSignedWallet() {
  // Create a random wallet without any prefix requirement (fast: 1 iteration)
  const ethWallet = Wallet.createRandom();
  const address = ethWallet.address;

  async function signHeaders(action, body = undefined) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyHash = body !== undefined ? hashRequestBody(body) : null;
    const message = buildSignatureMessage(action, timestamp, bodyHash);
    const signature = await ethWallet.signMessage(message);
    return Object.freeze({
      'x-wallet-address': address,
      'x-wallet-signature': signature,
      'x-wallet-timestamp': timestamp,
    });
  }

  return Object.freeze({ address, signHeaders });
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

module.exports = { BASE_URL, makeTestWallet, makeSignedWallet, api, get, post, put, del };
