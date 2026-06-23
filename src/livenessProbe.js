'use strict';

/**
 * Liveness probe — externally anchored trust signal.
 *
 * Performs HTTPS GET health checks against registered agent endpoints.
 * Results are stored in liveness_checks and rolled up into agents.
 * SSRF protection is mandatory before every fetch.
 */

const https = require('https');
const { resolveAndCheckHostname } = require('./utils/network');

const FETCH_TIMEOUT_MS = 5000;

/**
 * Perform an HTTPS GET pinned to a pre-validated IP address.
 *
 * Pinning the connection to the IP that ssrfGuard already validated closes the
 * DNS-rebinding TOCTOU window: the OS resolver is bypassed via the `lookup`
 * override so a malicious endpoint cannot swap in a private IP between the
 * guard's DNS lookup and connect time. TLS SNI + certificate validation still
 * use the real hostname (via `servername`), so HTTPS stays correct.
 *
 * Redirects are intentionally NOT followed (a public host could 30x to an
 * internal URL). A 3xx is treated as "reachable". The response body is never
 * read — only the status code matters — and the socket is freed immediately.
 *
 * @param {string} urlStr
 * @param {string} pinnedIp - a validated public IP from resolveAndCheckHostname
 * @param {number} pinnedFamily - 4 or 6
 * @returns {Promise<{ ok: boolean, statusCode: number|null, error?: string }>}
 */
function pinnedHttpsGet(urlStr, pinnedIp, pinnedFamily) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };

    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return done({ ok: false, statusCode: null, error: 'Invalid URL' });
    }

    const req = https.get({
      hostname: u.hostname,
      path: (u.pathname || '/') + (u.search || ''),
      port: u.port || 443,
      servername: u.hostname, // SNI + cert hostname validation
      headers: { 'User-Agent': 'AgentStamp-LivenessProbe/1.0', Host: u.host },
      // Pin DNS to the already-validated IP — no second, unchecked resolution.
      lookup: (hostname, opts, cb) => cb(null, pinnedIp, pinnedFamily || 4),
      timeout: FETCH_TIMEOUT_MS,
    }, (res) => {
      const status = res.statusCode;
      res.destroy(); // status code is all we need; release the socket now
      done({ ok: status >= 200 && status < 400, statusCode: status });
    });

    req.on('timeout', () => { req.destroy(); done({ ok: false, statusCode: null, error: 'timeout' }); });
    req.on('error', (e) => done({ ok: false, statusCode: null, error: e.message }));
  });
}

/**
 * Compute a liveness ratio summary from an agent row.
 * Pure function — no DB access, no side effects.
 *
 * @param {object} agent - Agent row with liveness_* columns
 * @returns {{ ratio: number|null, checks: number, last_ok: boolean|null, last_checked_at: string|null }}
 */
function computeLivenessRatio(agent) {
  const total = agent.liveness_total_count || 0;
  const success = agent.liveness_success_count || 0;
  const ratio = total > 0 ? Math.round((success / total) * 1000) / 1000 : null;

  return Object.freeze({
    ratio,
    checks: total,
    last_ok: agent.liveness_ok !== null && agent.liveness_ok !== undefined
      ? Boolean(agent.liveness_ok)
      : null,
    last_checked_at: agent.liveness_checked_at || null,
  });
}

/**
 * Guard an endpoint URL against SSRF before fetching.
 * Returns { safe: true } or { safe: false, error: string }.
 *
 * @param {string} url - The URL to check
 * @returns {Promise<{safe: boolean, error?: string}>}
 */
async function ssrfGuard(url) {
  // Only HTTPS is allowed
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { safe: false, error: 'Invalid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { safe: false, error: 'Only HTTPS endpoints are probed (non-HTTPS blocked)' };
  }

  const hostname = parsed.hostname;

  // Reject bare IP addresses (both private and public — only hostnames are probed)
  const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Re = /^(\[)?[0-9a-fA-F:]+(\])?$/;
  if (ipv4Re.test(hostname) || ipv6Re.test(hostname.replace(/^\[|\]$/g, ''))) {
    return { safe: false, error: 'Direct IP addresses are not allowed' };
  }

  return resolveAndCheckHostname(hostname);
}

/**
 * Run one liveness probe against a single agent.
 * Updates liveness_checks table and agents rolling counters.
 * Never throws — all errors are recorded as failed probes.
 *
 * @param {object} agent - Agent row
 * @param {object} db - better-sqlite3 instance
 * @returns {Promise<{agent_id: string, ok: boolean, status_code: number|null, latency_ms: number|null, error?: string}>}
 */
async function probeAgent(agent, db) {
  const url = agent.endpoint_url;
  const now = new Date().toISOString();

  let ok = false;
  let statusCode = null;
  let latencyMs = null;
  let probeError = null;

  try {
    const guard = await ssrfGuard(url);
    if (!guard.safe) {
      probeError = guard.error;
    } else {
      // Pin to a validated public IP (defeats DNS-rebinding). resolveAndCheckHostname
      // returns the checked addresses; fall back to a safe failure if absent.
      const pinned = Array.isArray(guard.addresses) && guard.addresses.length > 0
        ? guard.addresses[0]
        : null;
      if (!pinned) {
        probeError = 'No validated address to pin';
      } else {
        const start = Date.now();
        const r = await pinnedHttpsGet(url, pinned.address, pinned.family);
        latencyMs = Date.now() - start;
        statusCode = r.statusCode;
        ok = r.ok;
        if (r.error) probeError = r.error;
      }
    }
  } catch (outerErr) {
    probeError = outerErr.message;
  }

  // Record probe result
  try {
    db.prepare(`
      INSERT INTO liveness_checks (agent_id, wallet_address, endpoint_url, ok, status_code, latency_ms, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(agent.id, agent.wallet_address, url, ok ? 1 : 0, statusCode, latencyMs, now);

    // Update rolling counters and latest status on agent (immutable column update)
    db.prepare(`
      UPDATE agents
      SET liveness_ok = ?,
          liveness_checked_at = ?,
          liveness_success_count = liveness_success_count + ?,
          liveness_total_count = liveness_total_count + 1
      WHERE id = ?
    `).run(ok ? 1 : 0, now, ok ? 1 : 0, agent.id);
  } catch (dbErr) {
    // DB error must not crash the sweep — log and continue
    console.error(`[livenessProbe] DB write error for agent ${agent.id}:`, dbErr.message);
  }

  const result = { agent_id: agent.id, ok, status_code: statusCode, latency_ms: latencyMs };
  if (probeError) result.error = probeError;
  return Object.freeze(result);
}

/**
 * Run liveness sweep over active agents that have a non-empty endpoint_url.
 * Each probe is independent — one failure does NOT abort the sweep.
 *
 * @param {{ limit?: number }} options
 * @returns {Promise<{ probed: number, ok: number, failed: number, results: object[] }>}
 */
async function runLivenessSweep({ limit = 50 } = {}) {
  // Lazy-require to avoid circular dependency at module load
  const { getDb } = require('./database');
  const db = getDb();

  const agents = db.prepare(`
    SELECT id, wallet_address, endpoint_url, liveness_success_count, liveness_total_count, liveness_ok, liveness_checked_at
    FROM agents
    WHERE status = 'active'
      AND endpoint_url IS NOT NULL
      AND endpoint_url != ''
    LIMIT ?
  `).all(limit);

  const results = [];
  let okCount = 0;

  for (const agent of agents) {
    // One bad endpoint must not abort the sweep
    const result = await probeAgent(agent, db);
    results.push(result);
    if (result.ok) okCount++;
  }

  console.log(`[livenessProbe] Sweep complete: ${agents.length} probed, ${okCount} ok, ${agents.length - okCount} failed`);

  return Object.freeze({
    probed: agents.length,
    ok: okCount,
    failed: agents.length - okCount,
    results: Object.freeze(results),
  });
}

module.exports = { runLivenessSweep, computeLivenessRatio, ssrfGuard };
