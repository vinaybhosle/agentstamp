const crypto = require('crypto');
const dns = require('dns');
const { promisify } = require('util');

const dnsResolve = promisify(dns.resolve4);

/**
 * Check if an IP address is private/internal (SSRF protection).
 */
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true; // non-IPv4 → block
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

/**
 * Dispatch webhook events to registered URLs.
 * Fire-and-forget with 5s timeout. Best-effort — failures are silent.
 * DNS rebinding protection: resolve hostname to IP and verify it's public before connecting.
 */
async function dispatch(walletAddress, event, payload) {
  try {
    const { getDb } = require('./database');
    const db = getDb();

    const hooks = db.prepare(
      `SELECT * FROM webhooks WHERE wallet_address = ? AND active = 1`
    ).all(walletAddress).filter(hook => {
      try {
        const events = JSON.parse(hook.events);
        return Array.isArray(events) && events.includes(event);
      } catch { return false; }
    });

    for (const hook of hooks) {
      // SSRF re-validation: only allow HTTPS to public hosts
      let parsed;
      try {
        parsed = new URL(hook.url);
        if (parsed.protocol !== 'https:') continue;
        const h = parsed.hostname.toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
            h === '0.0.0.0' || h.endsWith('.local') || h.endsWith('.internal') ||
            h.startsWith('10.') || h.startsWith('192.168.') ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith('169.254.')) {
          continue;
        }
      } catch { continue; }

      // DNS rebinding protection: resolve hostname and verify IPs are public
      try {
        const ips = await dnsResolve(parsed.hostname);
        if (!ips || ips.length === 0 || ips.some(isPrivateIP)) continue;
      } catch {
        continue; // DNS resolution failed — skip this hook
      }

      const body = JSON.stringify({
        event,
        payload,
        timestamp: new Date().toISOString(),
      });

      const signature = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');

      try {
        fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AgentStamp-Signature': signature,
            'X-AgentStamp-Event': event,
          },
          body,
          signal: AbortSignal.timeout(5000),
        }).catch(() => {}); // Don't await, don't fail
      } catch (e) {
        // Silent failure — webhooks are best-effort
      }
    }
  } catch (e) {
    // Database not ready or other error — silently ignore
  }
}

module.exports = { dispatch };
