const { getDb } = require('./database');

/**
 * Wishing Well Market Insights — "What AI Agents Want"
 *
 * Generates market intelligence from wish data:
 * - Summary stats (total, grant rate, growth)
 * - Category distribution with grant rates
 * - Top unmet needs (ungrated wishes, sorted by recency)
 * - Velocity metrics (daily, weekly, monthly)
 * - Keyword extraction from wish texts
 * - Growth trends (this week vs last week)
 */

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function generateInsights() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) {
    return _cache;
  }

  const db = getDb();

  // Summary stats
  const total = db.prepare('SELECT COUNT(*) as count FROM wishes').get().count;
  const granted = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE granted = 1').get().count;
  const grantRate = total > 0 ? Math.round((granted / total) * 1000) / 10 : 0;

  // Category distribution with grant rates
  const categories = db.prepare(`
    SELECT
      category,
      COUNT(*) as total,
      SUM(CASE WHEN granted = 1 THEN 1 ELSE 0 END) as granted,
      ROUND(SUM(CASE WHEN granted = 1 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 1) as grant_rate
    FROM wishes
    GROUP BY category
    ORDER BY total DESC
  `).all();

  // Growth: this week vs last week
  const thisWeek = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now', '-7 days')"
  ).get().count;
  const lastWeek = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now', '-14 days') AND created_at < date('now', '-7 days')"
  ).get().count;
  const growthRate = lastWeek > 0
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 1000) / 10
    : (thisWeek > 0 ? 100 : 0);

  // Top unmet needs (ungranted wishes, most recent)
  const unmetNeeds = db.prepare(
    "SELECT id, wish_text, category, created_at FROM wishes WHERE granted = 0 ORDER BY created_at DESC LIMIT 10"
  ).all();

  // Velocity metrics
  const today = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now')"
  ).get().count;
  const thisMonth = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now', '-30 days')"
  ).get().count;

  // Daily average (last 30 days)
  const dailyAvg = thisMonth > 0 ? Math.round((thisMonth / 30) * 10) / 10 : 0;

  // Keyword extraction from wish texts (simple word frequency)
  const allWishTexts = db.prepare(
    "SELECT wish_text FROM wishes WHERE created_at >= date('now', '-30 days')"
  ).all();

  const stopWords = new Set([
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'the', 'a', 'an', 'and',
    'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may',
    'that', 'this', 'it', 'its', 'not', 'so', 'if', 'as', 'about', 'up',
    'out', 'no', 'more', 'want', 'need', 'wish', 'like', 'able', 'get',
  ]);

  const wordFreq = {};
  for (const { wish_text } of allWishTexts) {
    if (!wish_text) continue;
    const words = wish_text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  const emergingKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, count]) => ({ keyword, count }));

  // Most active wisher wallets (anonymized)
  const topWishers = db.prepare(`
    SELECT
      SUBSTR(wallet_address, 1, 6) || '...' || SUBSTR(wallet_address, -4) as wallet,
      COUNT(*) as wish_count
    FROM wishes
    GROUP BY wallet_address
    ORDER BY wish_count DESC
    LIMIT 5
  `).all();

  const insights = {
    generated_at: new Date().toISOString(),
    summary: {
      total_wishes: total,
      total_granted: granted,
      grant_rate_percent: grantRate,
      unmet_wishes: total - granted,
    },
    growth: {
      this_week: thisWeek,
      last_week: lastWeek,
      growth_rate_percent: growthRate,
      trend: growthRate > 0 ? 'growing' : growthRate < 0 ? 'declining' : 'stable',
    },
    velocity: {
      today,
      this_week: thisWeek,
      this_month: thisMonth,
      daily_average: dailyAvg,
    },
    category_distribution: categories,
    unmet_needs: unmetNeeds,
    emerging_keywords: emergingKeywords,
    top_wishers: topWishers,
  };

  _cache = insights;
  _cacheTime = now;
  return insights;
}

function clearInsightsCache() {
  _cache = null;
  _cacheTime = 0;
}

module.exports = { generateInsights, clearInsightsCache };
