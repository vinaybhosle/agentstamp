const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { computeReputation } = require('../reputation');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { timingSafeCompare } = require('../utils/timingSafeCompare');

/**
 * Analytics API — comprehensive KPIs for the admin dashboard.
 * Protected by X-Analytics-Key header.
 */

// Auth middleware
function requireAnalyticsKey(req, res, next) {
  const key = req.headers['x-analytics-key'];
  const expected = process.env.ANALYTICS_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'Analytics not configured' });
  }
  if (!key || !timingSafeCompare(key, expected, expected)) {
    return res.status(401).json({ error: 'Invalid or missing analytics key' });
  }
  next();
}

router.use(requireAnalyticsKey);

// GET /api/v1/analytics/dashboard — Full KPI dashboard data
router.get('/dashboard', (req, res) => {
  try {
    const db = getDb();
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ===================== REVENUE =====================
    const revenueTotal = db.prepare(
      'SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total, COUNT(*) as count FROM transactions'
    ).get();

    const revenueToday = db.prepare(
      'SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total, COUNT(*) as count FROM transactions WHERE created_at >= ?'
    ).get(todayStart);

    const revenueWeek = db.prepare(
      'SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total, COUNT(*) as count FROM transactions WHERE created_at >= ?'
    ).get(weekAgo);

    const revenueMonth = db.prepare(
      'SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total, COUNT(*) as count FROM transactions WHERE created_at >= ?'
    ).get(monthAgo);

    const revenueByAction = db.prepare(
      'SELECT action, COUNT(*) as count, COALESCE(SUM(CAST(amount AS REAL)), 0) as total_usdc FROM transactions GROUP BY action ORDER BY total_usdc DESC'
    ).all();

    const revenueByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(CAST(amount AS REAL)), 0) as total_usdc
       FROM transactions WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);

    const uniqueWallets = db.prepare(
      'SELECT COUNT(DISTINCT wallet_address) as count FROM transactions'
    ).get();

    const topPayers = db.prepare(
      `SELECT wallet_address, COUNT(*) as transaction_count, COALESCE(SUM(CAST(amount AS REAL)), 0) as total_usdc
       FROM transactions GROUP BY wallet_address ORDER BY total_usdc DESC LIMIT 10`
    ).all();

    const avgTransaction = revenueTotal.count > 0 ? revenueTotal.total / revenueTotal.count : 0;

    // Monthly projection based on last 30 days
    const daysElapsed = Math.max(1, Math.min(30, Math.ceil((now.getTime() - new Date(monthAgo).getTime()) / (24*60*60*1000))));
    const monthlyProjection = (revenueMonth.total / daysElapsed) * 30;

    // ===================== STAMPS =====================
    const stampTotal = db.prepare('SELECT COUNT(*) as count FROM stamps').get();
    const stampActive = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE expires_at > datetime('now') AND revoked = 0"
    ).get();
    const stampExpired = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE expires_at <= datetime('now')"
    ).get();
    const stampRevoked = db.prepare(
      'SELECT COUNT(*) as count FROM stamps WHERE revoked = 1'
    ).get();
    const stampToday = db.prepare(
      'SELECT COUNT(*) as count FROM stamps WHERE created_at >= ?'
    ).get(todayStart);
    const stampWeek = db.prepare(
      'SELECT COUNT(*) as count FROM stamps WHERE created_at >= ?'
    ).get(weekAgo);
    const stampMonth = db.prepare(
      'SELECT COUNT(*) as count FROM stamps WHERE created_at >= ?'
    ).get(monthAgo);
    const stampByTier = db.prepare(
      'SELECT tier, COUNT(*) as count FROM stamps GROUP BY tier'
    ).all();
    const stampExpiringSoon = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE expires_at > datetime('now') AND expires_at <= datetime('now', '+7 days') AND revoked = 0"
    ).get();
    const stampByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM stamps WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);

    // ===================== AGENTS =====================
    const agentTotal = db.prepare('SELECT COUNT(*) as count FROM agents').get();
    const agentActive = db.prepare(
      "SELECT COUNT(*) as count FROM agents WHERE status = 'active'"
    ).get();
    const agentExpired = db.prepare(
      "SELECT COUNT(*) as count FROM agents WHERE status = 'expired'"
    ).get();
    const agentToday = db.prepare(
      'SELECT COUNT(*) as count FROM agents WHERE created_at >= ?'
    ).get(todayStart);
    const agentWeek = db.prepare(
      'SELECT COUNT(*) as count FROM agents WHERE created_at >= ?'
    ).get(weekAgo);
    const agentMonth = db.prepare(
      'SELECT COUNT(*) as count FROM agents WHERE created_at >= ?'
    ).get(monthAgo);
    const agentByCategory = db.prepare(
      'SELECT COALESCE(category, \'uncategorized\') as category, COUNT(*) as count FROM agents GROUP BY category ORDER BY count DESC'
    ).all();
    const agentWithStamps = db.prepare(
      'SELECT COUNT(*) as count FROM agents WHERE stamp_id IS NOT NULL'
    ).get();
    const agentWithoutStamps = db.prepare(
      'SELECT COUNT(*) as count FROM agents WHERE stamp_id IS NULL'
    ).get();
    const avgEndorsements = db.prepare(
      'SELECT COALESCE(AVG(endorsement_count), 0) as avg FROM agents'
    ).get();
    const agentByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM agents WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);

    // ===================== ENDORSEMENTS =====================
    const endorseTotal = db.prepare('SELECT COUNT(*) as count FROM endorsements').get();
    const endorseToday = db.prepare(
      'SELECT COUNT(*) as count FROM endorsements WHERE created_at >= ?'
    ).get(todayStart);
    const endorseWeek = db.prepare(
      'SELECT COUNT(*) as count FROM endorsements WHERE created_at >= ?'
    ).get(weekAgo);
    const endorseMonth = db.prepare(
      'SELECT COUNT(*) as count FROM endorsements WHERE created_at >= ?'
    ).get(monthAgo);
    const uniqueEndorsers = db.prepare(
      'SELECT COUNT(DISTINCT endorser_wallet) as count FROM endorsements'
    ).get();
    const mostEndorsed = db.prepare(
      `SELECT a.id as agent_id, a.name, a.endorsement_count as count
       FROM agents a ORDER BY a.endorsement_count DESC LIMIT 10`
    ).all();
    const topEndorsers = db.prepare(
      `SELECT endorser_wallet as wallet, COUNT(*) as count
       FROM endorsements GROUP BY endorser_wallet ORDER BY count DESC LIMIT 10`
    ).all();
    const endorseByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM endorsements WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);

    // ===================== REPUTATION =====================
    const allAgents = db.prepare('SELECT id, name, last_reputation_score FROM agents').all();
    const repScores = allAgents.map(a => {
      const score = a.last_reputation_score || 0;
      const label = score > 75 ? 'elite' : score > 50 ? 'established' : score > 25 ? 'emerging' : 'new';
      return { agent_id: a.id, name: a.name, score, label };
    });
    const repAvg = repScores.length > 0
      ? repScores.reduce((sum, r) => sum + r.score, 0) / repScores.length
      : 0;
    const repDistribution = {
      new: repScores.filter(r => r.score <= 25).length,
      emerging: repScores.filter(r => r.score > 25 && r.score <= 50).length,
      established: repScores.filter(r => r.score > 50 && r.score <= 75).length,
      elite: repScores.filter(r => r.score > 75).length,
    };
    const topRated = repScores.sort((a, b) => b.score - a.score).slice(0, 10);

    // ===================== WISHES =====================
    const wishTotal = db.prepare('SELECT COUNT(*) as count FROM wishes').get();
    const wishGranted = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE granted = 1').get();
    const wishUnmet = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE granted = 0').get();
    const wishToday = db.prepare(
      'SELECT COUNT(*) as count FROM wishes WHERE created_at >= ?'
    ).get(todayStart);
    const wishWeek = db.prepare(
      'SELECT COUNT(*) as count FROM wishes WHERE created_at >= ?'
    ).get(weekAgo);
    const wishMonth = db.prepare(
      'SELECT COUNT(*) as count FROM wishes WHERE created_at >= ?'
    ).get(monthAgo);
    const wishGrantRate = wishTotal.count > 0
      ? ((wishGranted.count / wishTotal.count) * 100).toFixed(1)
      : 0;
    const wishByCategory = db.prepare(
      `SELECT COALESCE(category, 'uncategorized') as category, COUNT(*) as total,
       SUM(CASE WHEN granted = 1 THEN 1 ELSE 0 END) as granted
       FROM wishes GROUP BY category ORDER BY total DESC`
    ).all();
    const topWishes = db.prepare(
      'SELECT id, wish_text, category, grant_count FROM wishes ORDER BY grant_count DESC LIMIT 10'
    ).all();
    const topWishers = db.prepare(
      `SELECT wallet_address as wallet, COUNT(*) as count
       FROM wishes GROUP BY wallet_address ORDER BY count DESC LIMIT 10`
    ).all();
    const wishByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM wishes WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);
    const grantByDay = db.prepare(
      `SELECT DATE(granted_at) as date, COUNT(*) as count FROM wishes WHERE granted = 1 AND granted_at >= ? GROUP BY DATE(granted_at) ORDER BY date`
    ).all(startDate);

    // ===================== HEARTBEATS =====================
    const heartbeatTotal = db.prepare('SELECT COUNT(*) as count FROM heartbeat_log').get();
    const heartbeatToday = db.prepare(
      'SELECT COUNT(*) as count FROM heartbeat_log WHERE recorded_at >= ?'
    ).get(todayStart);
    const heartbeatWeek = db.prepare(
      'SELECT COUNT(*) as count FROM heartbeat_log WHERE recorded_at >= ?'
    ).get(weekAgo);
    const activeHeartbeaters = db.prepare(
      `SELECT COUNT(DISTINCT agent_id) as count FROM heartbeat_log WHERE recorded_at >= ?`
    ).get(todayStart);

    // ===================== FUNNEL & GROWTH =====================
    // Free stamps vs paid stamps
    const freeStamps = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE tier = 'free'"
    ).get();
    const paidStamps = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE tier != 'free'"
    ).get();
    const freeStampsMonth = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE tier = 'free' AND created_at >= ?"
    ).get(monthAgo);
    const paidStampsMonth = db.prepare(
      "SELECT COUNT(*) as count FROM stamps WHERE tier != 'free' AND created_at >= ?"
    ).get(monthAgo);

    // Free registrations vs paid registrations
    const freeRegistrations = db.prepare(
      'SELECT COUNT(*) as count FROM free_registration_cooldown'
    ).get();
    const paidRegistrations = db.prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE action = 'register'"
    ).get();

    // Conversion: wallets that did a free action then later did a paid action
    const freeToStampUpgrade = db.prepare(
      `SELECT COUNT(DISTINCT f.wallet_address) as count
       FROM free_stamp_cooldown f
       INNER JOIN stamps s ON f.wallet_address = s.wallet_address AND s.tier != 'free'`
    ).get();
    const freeToRegUpgrade = db.prepare(
      `SELECT COUNT(DISTINCT f.wallet_address) as count
       FROM free_registration_cooldown f
       INNER JOIN transactions t ON f.wallet_address = t.wallet_address AND t.action = 'register'`
    ).get();

    // Total unique free users (union of both cooldown tables)
    const totalFreeUsers = db.prepare(
      `SELECT COUNT(*) as count FROM (
        SELECT wallet_address FROM free_stamp_cooldown
        UNION
        SELECT wallet_address FROM free_registration_cooldown
      )`
    ).get();

    // Total paying users (unique wallets in transactions)
    const totalPayingUsers = db.prepare(
      'SELECT COUNT(DISTINCT wallet_address) as count FROM transactions'
    ).get();

    // Daily funnel: free stamps & paid stamps by day
    const freeStampsByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM stamps
       WHERE tier = 'free' AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);
    const paidStampsByDay = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM stamps
       WHERE tier != 'free' AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);

    // Conversion rate
    const stampConversionRate = totalFreeUsers.count > 0
      ? ((freeToStampUpgrade.count / totalFreeUsers.count) * 100).toFixed(1)
      : 0;
    const regConversionRate = freeRegistrations.count > 0
      ? ((freeToRegUpgrade.count / freeRegistrations.count) * 100).toFixed(1)
      : 0;

    // ===================== WEBHOOKS =====================
    const webhookTotal = db.prepare('SELECT COUNT(*) as count FROM webhooks').get();
    const webhookActive = db.prepare(
      'SELECT COUNT(*) as count FROM webhooks WHERE active = 1'
    ).get();
    const webhookByEvent = db.prepare(
      'SELECT events FROM webhooks'
    ).all();
    // Parse JSON events to build event distribution
    const eventCounts = {};
    webhookByEvent.forEach(row => {
      try {
        const events = JSON.parse(row.events);
        events.forEach(evt => {
          eventCounts[evt] = (eventCounts[evt] || 0) + 1;
        });
      } catch { /* ignore malformed */ }
    });
    const recentWebhooks = db.prepare(
      'SELECT id, wallet_address, url, events, active, created_at FROM webhooks ORDER BY created_at DESC LIMIT 10'
    ).all();

    // ===================== TRAFFIC =====================
    const trafficTotal = db.prepare('SELECT COUNT(*) as count FROM api_hits').get();
    const trafficToday = db.prepare(
      'SELECT COUNT(*) as count FROM api_hits WHERE created_at >= ?'
    ).get(todayStart);
    const trafficWeek = db.prepare(
      'SELECT COUNT(*) as count FROM api_hits WHERE created_at >= ?'
    ).get(weekAgo);
    const trafficMonth = db.prepare(
      'SELECT COUNT(*) as count FROM api_hits WHERE created_at >= ?'
    ).get(monthAgo);

    const uniqueVisitors = db.prepare(
      'SELECT COUNT(DISTINCT ip_hash) as count FROM api_hits'
    ).get();
    const uniqueVisitorsToday = db.prepare(
      'SELECT COUNT(DISTINCT ip_hash) as count FROM api_hits WHERE created_at >= ?'
    ).get(todayStart);
    const uniqueVisitorsWeek = db.prepare(
      'SELECT COUNT(DISTINCT ip_hash) as count FROM api_hits WHERE created_at >= ?'
    ).get(weekAgo);

    // Bot vs human
    const botHits = db.prepare(
      'SELECT COUNT(*) as count FROM api_hits WHERE is_bot = 1'
    ).get();
    const humanHits = db.prepare(
      'SELECT COUNT(*) as count FROM api_hits WHERE is_bot = 0'
    ).get();

    // Identified traffic (has wallet header)
    const identifiedHits = db.prepare(
      'SELECT COUNT(*) as count FROM api_hits WHERE wallet_address IS NOT NULL'
    ).get();
    const uniqueWalletVisitors = db.prepare(
      'SELECT COUNT(DISTINCT wallet_address) as count FROM api_hits WHERE wallet_address IS NOT NULL'
    ).get();

    // Top endpoints
    const topEndpoints = db.prepare(
      `SELECT path, method, COUNT(*) as hits,
       ROUND(AVG(response_time_ms), 0) as avg_response_ms,
       SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
       FROM api_hits GROUP BY path, method ORDER BY hits DESC LIMIT 20`
    ).all();

    // Normalize paths for grouped view (collapse IDs)
    const endpointGroups = db.prepare(
      `SELECT
        CASE
          WHEN path LIKE '/api/v1/registry/agent/%/reputation' THEN '/api/v1/registry/agent/:id/reputation'
          WHEN path LIKE '/api/v1/registry/agent/%' THEN '/api/v1/registry/agent/:id'
          WHEN path LIKE '/api/v1/registry/endorse/%' THEN '/api/v1/registry/endorse/:id'
          WHEN path LIKE '/api/v1/registry/update/%' THEN '/api/v1/registry/update/:id'
          WHEN path LIKE '/api/v1/registry/heartbeat/%' THEN '/api/v1/registry/heartbeat/:id'
          WHEN path LIKE '/api/v1/stamp/verify/%' THEN '/api/v1/stamp/verify/:id'
          WHEN path LIKE '/api/v1/stamp/mint/%' THEN '/api/v1/stamp/mint/:tier'
          WHEN path LIKE '/api/v1/well/wish/%' THEN '/api/v1/well/wish/:id'
          WHEN path LIKE '/api/v1/well/grant/%' THEN '/api/v1/well/grant/:id'
          WHEN path LIKE '/api/v1/passport/%/a2a' THEN '/api/v1/passport/:wallet/a2a'
          WHEN path LIKE '/api/v1/passport/%' THEN '/api/v1/passport/:wallet'
          WHEN path LIKE '/api/v1/badge/%/json' THEN '/api/v1/badge/:wallet/json'
          WHEN path LIKE '/api/v1/badge/%' THEN '/api/v1/badge/:wallet'
          ELSE path
        END as route,
        method,
        COUNT(*) as hits,
        COUNT(DISTINCT ip_hash) as unique_visitors,
        ROUND(AVG(response_time_ms), 0) as avg_ms
       FROM api_hits
       GROUP BY route, method
       ORDER BY hits DESC
       LIMIT 25`
    ).all();

    // Traffic by day
    const trafficByDay = db.prepare(
      `SELECT DATE(created_at) as date,
       COUNT(*) as hits,
       COUNT(DISTINCT ip_hash) as visitors,
       SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_hits,
       SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human_hits
       FROM api_hits WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
    ).all(startDate);

    // Traffic by hour (last 24h)
    const trafficByHour = db.prepare(
      `SELECT strftime('%H', created_at) as hour, COUNT(*) as hits
       FROM api_hits WHERE created_at >= ? GROUP BY hour ORDER BY hour`
    ).all(todayStart);

    // Top user agents
    const topUserAgents = db.prepare(
      `SELECT user_agent, COUNT(*) as hits, is_bot
       FROM api_hits WHERE user_agent IS NOT NULL
       GROUP BY user_agent ORDER BY hits DESC LIMIT 15`
    ).all();

    // Top referrers
    const topReferrers = db.prepare(
      `SELECT referrer, COUNT(*) as hits
       FROM api_hits WHERE referrer IS NOT NULL AND referrer != ''
       GROUP BY referrer ORDER BY hits DESC LIMIT 10`
    ).all();

    // Response time stats
    const responseTimeStats = db.prepare(
      `SELECT
       ROUND(AVG(response_time_ms), 0) as avg_ms,
       MIN(response_time_ms) as min_ms,
       MAX(response_time_ms) as max_ms
       FROM api_hits WHERE response_time_ms IS NOT NULL`
    ).get();

    // Status code distribution
    const statusCodes = db.prepare(
      `SELECT
       SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as '2xx',
       SUM(CASE WHEN status_code >= 300 AND status_code < 400 THEN 1 ELSE 0 END) as '3xx',
       SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as '4xx',
       SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as '5xx'
       FROM api_hits`
    ).get();

    // Error rate
    const errorRate = trafficTotal.count > 0
      ? (((statusCodes['4xx'] || 0) + (statusCodes['5xx'] || 0)) / trafficTotal.count * 100).toFixed(1)
      : 0;

    // ===================== SYSTEM =====================
    let dbSizeMb = 0;
    try {
      const dbPath = config.dbPath || './data/agentstamp.db';
      const stats = fs.statSync(dbPath);
      dbSizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    } catch { /* ignore */ }

    const tableRowCounts = {
      stamps: stampTotal.count,
      agents: agentTotal.count,
      endorsements: endorseTotal.count,
      wishes: wishTotal.count,
      transactions: revenueTotal.count,
      heartbeat_log: heartbeatTotal.count,
      webhooks: webhookTotal.count,
      free_stamp_cooldown: freeStamps.count,
      free_registration_cooldown: freeRegistrations.count,
      api_hits: trafficTotal.count,
    };

    // ===================== RECENT ACTIVITY =====================
    const recentTransactions = db.prepare(
      `SELECT id, endpoint, wallet_address, amount, action, reference_id, created_at
       FROM transactions ORDER BY created_at DESC LIMIT 20`
    ).all();

    const recentAgents = db.prepare(
      `SELECT id, name, category, wallet_address, created_at
       FROM agents ORDER BY created_at DESC LIMIT 10`
    ).all();

    const recentStamps = db.prepare(
      `SELECT id, wallet_address, tier, issued_at, expires_at
       FROM stamps ORDER BY created_at DESC LIMIT 10`
    ).all();

    // ===================== RESPONSE =====================
    res.json({
      success: true,
      generated_at: now.toISOString(),
      period: { days, start: startDate, end: now.toISOString() },

      revenue: {
        total_usdc: parseFloat(revenueTotal.total.toFixed(6)),
        today: parseFloat(revenueToday.total.toFixed(6)),
        this_week: parseFloat(revenueWeek.total.toFixed(6)),
        this_month: parseFloat(revenueMonth.total.toFixed(6)),
        total_transactions: revenueTotal.count,
        average_transaction: parseFloat(avgTransaction.toFixed(6)),
        unique_wallets: uniqueWallets.count,
        monthly_projection: parseFloat(monthlyProjection.toFixed(6)),
        by_action: revenueByAction,
        by_day: revenueByDay,
        top_payers: topPayers,
      },

      stamps: {
        total: stampTotal.count,
        active: stampActive.count,
        expired: stampExpired.count,
        revoked: stampRevoked.count,
        today: stampToday.count,
        this_week: stampWeek.count,
        this_month: stampMonth.count,
        by_tier: Object.fromEntries(stampByTier.map(t => [t.tier, t.count])),
        expiring_soon: stampExpiringSoon.count,
        by_day: stampByDay,
      },

      agents: {
        total: agentTotal.count,
        active: agentActive.count,
        expired: agentExpired.count,
        today: agentToday.count,
        this_week: agentWeek.count,
        this_month: agentMonth.count,
        by_category: Object.fromEntries(agentByCategory.map(c => [c.category, c.count])),
        with_stamps: agentWithStamps.count,
        without_stamps: agentWithoutStamps.count,
        average_endorsements: parseFloat(avgEndorsements.avg.toFixed(1)),
        by_day: agentByDay,
      },

      endorsements: {
        total: endorseTotal.count,
        today: endorseToday.count,
        this_week: endorseWeek.count,
        this_month: endorseMonth.count,
        unique_endorsers: uniqueEndorsers.count,
        most_endorsed: mostEndorsed,
        top_endorsers: topEndorsers,
        by_day: endorseByDay,
      },

      reputation: {
        average_score: parseFloat(repAvg.toFixed(1)),
        distribution: repDistribution,
        top_agents: topRated,
      },

      wishes: {
        total: wishTotal.count,
        granted: wishGranted.count,
        unmet: wishUnmet.count,
        grant_rate: parseFloat(wishGrantRate),
        today: wishToday.count,
        this_week: wishWeek.count,
        this_month: wishMonth.count,
        by_category: wishByCategory,
        top_wishes: topWishes,
        top_wishers: topWishers,
        by_day: wishByDay,
        grants_by_day: grantByDay,
      },

      heartbeats: {
        total: heartbeatTotal.count,
        today: heartbeatToday.count,
        this_week: heartbeatWeek.count,
        active_agents_today: activeHeartbeaters.count,
      },

      funnel: {
        free_stamps: freeStamps.count,
        paid_stamps: paidStamps.count,
        free_stamps_month: freeStampsMonth.count,
        paid_stamps_month: paidStampsMonth.count,
        free_registrations: freeRegistrations.count,
        paid_registrations: paidRegistrations.count,
        total_free_users: totalFreeUsers.count,
        total_paying_users: totalPayingUsers.count,
        stamp_upgrades: freeToStampUpgrade.count,
        reg_upgrades: freeToRegUpgrade.count,
        stamp_conversion_rate: parseFloat(stampConversionRate),
        reg_conversion_rate: parseFloat(regConversionRate),
        free_stamps_by_day: freeStampsByDay,
        paid_stamps_by_day: paidStampsByDay,
      },

      webhooks_stats: {
        total: webhookTotal.count,
        active: webhookActive.count,
        inactive: webhookTotal.count - webhookActive.count,
        event_distribution: eventCounts,
        recent: recentWebhooks,
      },

      traffic: {
        total_hits: trafficTotal.count,
        today: trafficToday.count,
        this_week: trafficWeek.count,
        this_month: trafficMonth.count,
        unique_visitors: uniqueVisitors.count,
        unique_visitors_today: uniqueVisitorsToday.count,
        unique_visitors_week: uniqueVisitorsWeek.count,
        bot_hits: botHits.count,
        human_hits: humanHits.count,
        bot_ratio: trafficTotal.count > 0 ? parseFloat(((botHits.count / trafficTotal.count) * 100).toFixed(1)) : 0,
        identified_hits: identifiedHits.count,
        unique_wallet_visitors: uniqueWalletVisitors.count,
        top_endpoints: topEndpoints,
        endpoint_groups: endpointGroups,
        by_day: trafficByDay,
        by_hour: trafficByHour,
        top_user_agents: topUserAgents,
        top_referrers: topReferrers,
        response_time: responseTimeStats,
        status_codes: statusCodes,
        error_rate: parseFloat(errorRate),
      },

      system: {
        db_size_mb: parseFloat(dbSizeMb),
        tables: tableRowCounts,
        server_start: process.uptime ? Math.floor(process.uptime()) : null,
      },

      recent_activity: {
        transactions: recentTransactions,
        agents: recentAgents,
        stamps: recentStamps,
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate analytics' });
  }
});

module.exports = router;
