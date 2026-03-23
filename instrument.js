/**
 * Sentry instrumentation for AgentStamp API.
 * MUST be imported before any other module in server.js.
 */

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN_AS || process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  release: process.env.SENTRY_RELEASE || `agentstamp@${require('./package.json').version || '2.2.0'}`,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE || '0.1'),
  profilesSampleRate: 0.1,
  attachStacktrace: true,
  enabled: !!(process.env.SENTRY_DSN_AS || process.env.SENTRY_DSN),
  // Scrub wallet addresses and IP data from error reports
  beforeSend(event) {
    if (event.request) {
      // Redact x-wallet-address header
      if (event.request.headers) {
        const headers = { ...event.request.headers };
        if (headers['x-wallet-address']) {
          headers['x-wallet-address'] = headers['x-wallet-address'].slice(0, 6) + '...' + headers['x-wallet-address'].slice(-4);
        }
        // Remove signature headers entirely
        delete headers['x-wallet-signature'];
        delete headers['x-wallet-timestamp'];
        delete headers['x-analytics-key'];
        delete headers['x-admin-key'];
        event.request = { ...event.request, headers };
      }
      // Scrub query params that might contain wallets
      if (event.request.query_string) {
        event.request = { ...event.request, query_string: '[REDACTED]' };
      }
    }
    return event;
  },
});

module.exports = Sentry;
