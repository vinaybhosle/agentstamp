const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDb } = require('../database');
const { generateWebhookId } = require('../utils/generateId');
const { requireSignature } = require('../middleware/walletSignature');

const VALID_EVENTS = ['stamp_minted', 'stamp_expiring', 'endorsement_received', 'wish_granted', 'wish_matched', 'reputation_changed', 'agent_registered'];

// POST /api/v1/webhooks/register — Register a webhook
router.post('/register', requireSignature({ required: true, action: 'webhook_register' }), (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'wallet_address is required' });
    }

    const { url, events } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    // SSRF protection: reject private/internal URLs
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.local') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
        hostname.startsWith('169.254.')
      ) {
        return res.status(400).json({ success: false, error: 'Webhook URLs must not point to private or internal addresses' });
      }
      if (parsed.protocol !== 'https:') {
        return res.status(400).json({ success: false, error: 'Webhook URLs must use HTTPS' });
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, error: `events must be an array. Valid events: ${VALID_EVENTS.join(', ')}` });
    }

    for (const event of events) {
      if (!VALID_EVENTS.includes(event)) {
        return res.status(400).json({ success: false, error: `Invalid event: ${event}. Valid events: ${VALID_EVENTS.join(', ')}` });
      }
    }

    const db = getDb();

    // Max 3 webhooks per wallet
    const existing = db.prepare('SELECT COUNT(*) as count FROM webhooks WHERE wallet_address = ?').get(walletAddress);
    if (existing.count >= 3) {
      return res.status(429).json({ success: false, error: 'Maximum 3 webhooks per wallet. Delete an existing one first.' });
    }

    const id = generateWebhookId();
    const secret = crypto.randomBytes(32).toString('hex');

    db.prepare(`
      INSERT INTO webhooks (id, wallet_address, url, events, secret)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, walletAddress, url, JSON.stringify(events), secret);

    res.status(201).json({
      success: true,
      webhook: { id, url, events, secret },
      note: 'Save the secret — it is used to verify webhook payloads via HMAC-SHA256 (X-AgentStamp-Signature header).',
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'A webhook with this URL is already registered for this wallet' });
    }
    console.error('Webhook register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/webhooks — List webhooks for a wallet (requires signature to prevent enumeration)
router.get('/', requireSignature({ required: true, action: 'webhook_list' }), (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'x-wallet-address header required' });
    }

    const db = getDb();
    const hooks = db.prepare('SELECT id, url, events, active, created_at FROM webhooks WHERE wallet_address = ?').all(walletAddress);

    res.json({
      success: true,
      webhooks: hooks.map(h => ({ ...h, events: JSON.parse(h.events), active: !!h.active })),
    });
  } catch (err) {
    console.error('Webhook list error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/v1/webhooks/:id — Remove a webhook
router.delete('/:id', requireSignature({ required: true, action: 'webhook_delete' }), (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'x-wallet-address header required' });
    }

    const db = getDb();
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
    if (!hook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    if (hook.wallet_address !== walletAddress) {
      return res.status(403).json({ success: false, error: 'Only the webhook owner can delete it' });
    }

    db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    console.error('Webhook delete error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
