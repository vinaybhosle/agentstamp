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
const mutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many mutation requests. Max 10 per minute.' },
});

// Read-heavy limiter for free browse/search endpoints
const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many read requests. Max 60 per minute.' },
});

// Analytics limiter — admin-only, still bounded
const analyticsLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many analytics requests. Max 20 per minute.' },
});

module.exports = { globalLimiter, mutationLimiter, readLimiter, analyticsLimiter };
