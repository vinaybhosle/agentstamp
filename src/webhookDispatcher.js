const crypto = require('crypto');

/**
 * Dispatch webhook events to registered URLs.
 * Fire-and-forget with 5s timeout. Best-effort — failures are silent.
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
