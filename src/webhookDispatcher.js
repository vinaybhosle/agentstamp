const crypto = require('crypto');
const { isPrivateIp, resolveAndCheckHostname } = require('./utils/network');

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

      // DNS rebinding protection: resolve hostname and verify IPs are public (dual-stack IPv4+IPv6)
      const dnsCheck = await resolveAndCheckHostname(parsed.hostname);
      if (!dnsCheck.safe) continue;

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
