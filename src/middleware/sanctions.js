/**
 * OFAC Sanctions Screening Middleware
 *
 * Checks wallet addresses against a list of sanctioned addresses
 * loaded from data/sanctioned-addresses.json.
 *
 * Toggle via SANCTIONS_CHECK_ENABLED env var (default: true).
 * In production, populate data/sanctioned-addresses.json with
 * OFAC SDN-listed crypto addresses.
 */

const fs = require('fs');
const path = require('path');

const SANCTIONED_ADDRESSES_PATH = path.resolve(
  __dirname,
  '../../data/sanctioned-addresses.json'
);

/**
 * Load sanctioned addresses into an immutable Set.
 * Normalizes all addresses to lowercase for case-insensitive matching.
 * @returns {Set<string>}
 */
function loadSanctionedAddresses() {
  try {
    const raw = fs.readFileSync(SANCTIONED_ADDRESSES_PATH, 'utf-8');
    const addresses = JSON.parse(raw);

    if (!Array.isArray(addresses)) {
      console.error('sanctions: sanctioned-addresses.json must be a JSON array');
      return new Set();
    }

    return new Set(
      addresses
        .filter(addr => typeof addr === 'string' && addr.length > 0)
        .map(addr => addr.toLowerCase())
    );
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('sanctions: sanctioned-addresses.json not found — no addresses blocked');
    } else {
      console.error('sanctions: failed to load sanctioned addresses:', err.message);
    }
    return new Set();
  }
}

// Load once at startup (immutable reference)
let sanctionedSet = loadSanctionedAddresses();

// Watch for file changes and auto-reload (hot-reload after daily cron)
try {
  fs.watch(SANCTIONED_ADDRESSES_PATH, { persistent: false }, (eventType) => {
    if (eventType === 'change') {
      const updated = loadSanctionedAddresses();
      sanctionedSet = updated;
      console.log(`sanctions: reloaded ${updated.size} addresses after file change`);
    }
  });
} catch (_watchErr) {
  // File may not exist yet — that is fine, watch will fail silently
}

/**
 * Reload the sanctioned addresses from disk.
 * Call this if the file is updated at runtime (e.g. via admin endpoint).
 */
function reloadSanctionedAddresses() {
  sanctionedSet = loadSanctionedAddresses();
}

/**
 * Check whether a wallet address is sanctioned.
 * @param {string} walletAddress
 * @returns {{ sanctioned: boolean }}
 */
function checkSanctions(walletAddress) {
  if (!walletAddress || typeof walletAddress !== 'string') {
    return { sanctioned: false };
  }
  return { sanctioned: sanctionedSet.has(walletAddress.toLowerCase()) };
}

/**
 * Whether sanctions checking is enabled.
 * Reads SANCTIONS_CHECK_ENABLED env var (default: 'true').
 * @returns {boolean}
 */
function isEnabled() {
  const envVal = process.env.SANCTIONS_CHECK_ENABLED;
  if (envVal === undefined || envVal === null) return true;
  return envVal.toLowerCase() !== 'false' && envVal !== '0';
}

/**
 * Express middleware that blocks sanctioned wallet addresses.
 *
 * Extracts wallet from:
 *   1. req.headers['x-wallet-address']
 *   2. req.body.wallet_address
 *
 * Returns 403 if the address is on the sanctions list.
 * Logs only "sanctioned address blocked" + timestamp (no PII).
 */
function sanctionsCheck(req, res, next) {
  if (!isEnabled()) {
    return next();
  }

  const walletAddress =
    req.headers['x-wallet-address'] || (req.body && req.body.wallet_address);

  if (!walletAddress) {
    return next();
  }

  const result = checkSanctions(walletAddress);

  if (result.sanctioned) {
    console.warn(
      `sanctions: sanctioned address blocked at ${new Date().toISOString()}`
    );
    return res.status(403).json({
      success: false,
      error: 'This address is blocked due to regulatory restrictions.',
    });
  }

  next();
}

module.exports = {
  checkSanctions,
  sanctionsCheck,
  reloadSanctionedAddresses,
  isEnabled,
};
