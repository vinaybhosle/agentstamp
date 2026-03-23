/**
 * Network security utilities — shared across webhook registration and dispatch.
 * Provides IPv4 + IPv6 SSRF protection.
 */

const dns = require('dns');

/**
 * Check if an IP address is private/internal (SSRF protection).
 * Covers IPv4, IPv6, IPv4-mapped IPv6, and edge cases.
 *
 * @param {string} ip - The IP address to check
 * @returns {boolean} True if the IP is private/internal
 */
function isPrivateIp(ip) {
  // Normalize IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalized = v4Mapped ? v4Mapped[1] : ip;

  // IPv4 private ranges
  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;
  if (normalized === '0.0.0.0') return true;

  // IPv6 private ranges
  if (ip === '::1' || ip === '::') return true;
  if (/^fe80:/i.test(ip)) return true; // link-local
  if (/^fc00:/i.test(ip) || /^fd[0-9a-f]{2}:/i.test(ip)) return true; // unique local
  if (/^::ffff:(127\.|10\.|192\.168\.|0\.)/i.test(ip)) return true;
  if (/^::ffff:172\.(1[6-9]|2\d|3[01])\./i.test(ip)) return true; // IPv4-mapped 172.16-31.x
  if (/^::ffff:169\.254\./i.test(ip)) return true; // IPv4-mapped link-local

  return false;
}

/**
 * Resolve a hostname and verify all resolved IPs are public.
 * Uses dual-stack DNS (both IPv4 and IPv6).
 *
 * @param {string} hostname - The hostname to resolve
 * @returns {Promise<{safe: boolean, error?: string}>}
 */
async function resolveAndCheckHostname(hostname) {
  try {
    // Use all: true to get EVERY resolved IP (both IPv4 and IPv6)
    // Single-IP lookup ({family: 0} without all) only returns one address,
    // allowing DNS rebinding via multi-A records (one public + one private)
    const addresses = await dns.promises.lookup(hostname, { all: true, family: 0 });
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: 'Hostname resolved to no addresses' };
    }
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return { safe: false, error: 'Hostname resolves to a private IP address' };
      }
    }
    return { safe: true };
  } catch (dnsErr) {
    return { safe: false, error: 'Hostname could not be resolved' };
  }
}

module.exports = { isPrivateIp, resolveAndCheckHostname };
