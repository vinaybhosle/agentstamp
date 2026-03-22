const crypto = require('crypto');

/**
 * Timing-safe string comparison using HMAC.
 * @param {string} input - The user-provided value
 * @param {string} expected - The expected value
 * @param {string} hmacKey - The HMAC key for comparison
 * @returns {boolean} True if input matches expected
 */
function timingSafeCompare(input, expected, hmacKey) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  if (!hmacKey) return false; // fail-closed: no key configured
  const hashA = crypto.createHmac('sha256', hmacKey).update(input).digest();
  const hashB = crypto.createHmac('sha256', hmacKey).update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

module.exports = { timingSafeCompare };
