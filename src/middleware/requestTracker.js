const crypto = require('crypto');

/**
 * Lightweight API request tracking middleware.
 * Logs every API request to the api_hits table asynchronously (non-blocking).
 * Skips health checks, static assets, and the analytics endpoint itself.
 */

const SKIP_PATHS = ['/health', '/favicon.ico', '/og-image', '/robots.txt', '/sitemap.xml'];
const SKIP_EXTENSIONS = ['.css', '.js', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.map'];

// Common bot/agent patterns in user-agent strings
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /curl/i, /wget/i, /python/i, /httpx/i,
  /axios/i, /node-fetch/i, /undici/i, /go-http/i, /java\//i, /ruby/i,
  /perl/i, /php/i, /libhttp/i, /scrapy/i, /headless/i,
  /claude/i, /openai/i, /gpt/i, /anthropic/i, /gemini/i, /copilot/i,
  /mcp/i, /agent/i, /llm/i, /ai[- ]?assistant/i,
];

function isBot(ua) {
  if (!ua) return true; // No user-agent = likely programmatic
  return BOT_PATTERNS.some(p => p.test(ua));
}

function hashIp(ip) {
  if (!ip) return 'unknown';
  const config = require('../config');
  return crypto.createHash('sha256').update(ip + config.ipHashSalt).digest('hex').slice(0, 16);
}

function shouldSkip(path) {
  if (SKIP_PATHS.some(s => path === s || path.startsWith(s))) return true;
  if (SKIP_EXTENSIONS.some(ext => path.endsWith(ext))) return true;
  if (path.startsWith('/api/v1/analytics')) return true; // Don't track analytics calls
  return false;
}

function requestTracker(getDb) {
  // Prepare statement eagerly at middleware creation time (DB is already initialized)
  let insertStmt = null;
  try {
    const db = getDb();
    insertStmt = db.prepare(
      `INSERT INTO api_hits (method, path, status_code, response_time_ms, ip_hash, user_agent, wallet_address, is_bot, referrer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
  } catch (e) {
    // DB not ready yet — will retry lazily on first request
  }

  return (req, res, next) => {
    const path = req.path;

    // Skip non-API noise
    if (shouldSkip(path)) return next();

    const startTime = Date.now();

    // Hook into response finish
    res.on('finish', () => {
      try {
        if (!insertStmt) {
          const db = getDb();
          insertStmt = db.prepare(
            `INSERT INTO api_hits (method, path, status_code, response_time_ms, ip_hash, user_agent, wallet_address, is_bot, referrer, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          );
        }

        const elapsed = Date.now() - startTime;
        const ip = req.ip || req.connection?.remoteAddress || '';
        const ua = (req.headers['user-agent'] || '').slice(0, 300);
        const rawWallet = req.headers['x-wallet-address'] || null;
        const wallet = rawWallet && /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(rawWallet)
          ? rawWallet
          : null;
        const ref = (req.headers['referer'] || req.headers['referrer'] || '').slice(0, 500);

        insertStmt.run(
          req.method,
          path.slice(0, 200), // cap path length
          res.statusCode,
          elapsed,
          hashIp(ip),
          ua || null,
          wallet,
          isBot(ua) ? 1 : 0,
          ref || null
        );
      } catch (e) {
        // Non-blocking — never crash the request for tracking
        if (!e.message?.includes('no such table')) {
          console.error('Request tracker error:', e.message);
        }
      }
    });

    next();
  };
}

module.exports = requestTracker;
