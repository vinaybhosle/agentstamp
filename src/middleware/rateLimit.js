const rateLimit = require('express-rate-limit');
const config = require('../config');

// Global limiter — baseline protection for all routes
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// Strict limiter for paid mutation routes (mint, register, endorse, wish, grant)
const mutationMax = parseInt(process.env.RATE_LIMIT_MUTATION_MAX, 10) || 10;
const mutationLimiter = rateLimit({
  windowMs: 60_000,
  max: mutationMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: `Too many mutation requests. Max ${mutationMax} per minute.` },
});

// Read-heavy limiter for free browse/search endpoints
const readMax = parseInt(process.env.RATE_LIMIT_READ_MAX, 10) || 60;
const readLimiter = rateLimit({
  windowMs: 60_000,
  max: readMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: `Too many read requests. Max ${readMax} per minute.` },
});

// Analytics limiter — admin-only, still bounded
const analyticsMax = parseInt(process.env.RATE_LIMIT_ANALYTICS_MAX, 10) || 20;
const analyticsLimiter = rateLimit({
  windowMs: 60_000,
  max: analyticsMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: `Too many analytics requests. Max ${analyticsMax} per minute.` },
});

module.exports = { globalLimiter, mutationLimiter, readLimiter, analyticsLimiter };
