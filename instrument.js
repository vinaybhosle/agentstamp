/**
 * Sentry instrumentation for AgentStamp API.
 * MUST be imported before any other module in server.js.
 */

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN_AS || process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  release: 'agentstamp@2.1.0',
  tracesSampleRate: 1.0,
  profilesSampleRate: 0.1,
  attachStacktrace: true,
  enabled: !!(process.env.SENTRY_DSN_AS || process.env.SENTRY_DSN),
});

module.exports = Sentry;
