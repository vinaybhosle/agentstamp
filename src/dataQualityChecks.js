// Data Quality Checks for AgentStamp
// CommonJS module — runs against a better-sqlite3 database instance

const VALID_TIERS = ['free', 'bronze', 'silver', 'gold'];
const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;
const VALID_AGENT_CATEGORIES = ['data', 'trading', 'research', 'creative', 'infrastructure', 'other'];
const VALID_WISH_CATEGORIES = ['capability', 'data', 'connection', 'existential', 'other'];
const VALID_AGENT_STATUSES = ['active', 'expired', 'suspended'];
const VALID_ACTIONS = [
  'stamp_mint', 'free_mint', 'agent_register', 'free_register',
  'agent_update', 'agent_endorse', 'wish_create', 'wish_grant',
];
const VALID_WEBHOOK_EVENTS = [
  'stamp_minted', 'stamp_expiring', 'endorsement_received',
  'wish_granted', 'wish_matched', 'reputation_changed', 'agent_registered',
];

function finding(table, check, severity, row_id, detail) {
  return { table, check, severity, row_id, detail };
}

// ─── Stamps ─────────────────────────────────────────────────────────────────

function runStampsChecks(db) {
  const findings = [];
  const rows = db.prepare('SELECT * FROM stamps').all();

  for (const row of rows) {
    // invalid_wallet_address
    if (!WALLET_REGEX.test(row.wallet_address)) {
      findings.push(finding('stamps', 'invalid_wallet_address', 'error', row.id,
        `wallet_address "${row.wallet_address}" does not match expected format`));
    }

    // invalid_tier
    if (!VALID_TIERS.includes(row.tier)) {
      findings.push(finding('stamps', 'invalid_tier', 'error', row.id,
        `tier "${row.tier}" is not one of ${VALID_TIERS.join(', ')}`));
    }

    // expired_not_revoked
    if (new Date(row.expires_at) < new Date() && !row.revoked) {
      findings.push(finding('stamps', 'expired_not_revoked', 'warning', row.id,
        `stamp expired at ${row.expires_at} but revoked flag is 0`));
    }

    // invalid_certificate_json
    try {
      JSON.parse(row.certificate);
    } catch {
      findings.push(finding('stamps', 'invalid_certificate_json', 'error', row.id,
        'certificate column is not valid JSON'));
    }

    // invalid_id_prefix
    if (!row.id.startsWith('stmp_')) {
      findings.push(finding('stamps', 'invalid_id_prefix', 'warning', row.id,
        `id "${row.id}" does not start with "stmp_"`));
    }
  }

  return findings;
}

// ─── Agents ─────────────────────────────────────────────────────────────────

function runAgentsChecks(db) {
  const findings = [];
  const rows = db.prepare('SELECT * FROM agents').all();

  for (const row of rows) {
    // invalid_wallet_address
    if (!WALLET_REGEX.test(row.wallet_address)) {
      findings.push(finding('agents', 'invalid_wallet_address', 'error', row.id,
        `wallet_address "${row.wallet_address}" does not match expected format`));
    }

    // invalid_id_prefix
    if (!row.id.startsWith('agt_')) {
      findings.push(finding('agents', 'invalid_id_prefix', 'warning', row.id,
        `id "${row.id}" does not start with "agt_"`));
    }

    // invalid_category
    if (row.category && !VALID_AGENT_CATEGORIES.includes(row.category)) {
      findings.push(finding('agents', 'invalid_category', 'error', row.id,
        `category "${row.category}" is not one of ${VALID_AGENT_CATEGORIES.join(', ')}`));
    }

    // invalid_status
    if (row.status && !VALID_AGENT_STATUSES.includes(row.status)) {
      findings.push(finding('agents', 'invalid_status', 'error', row.id,
        `status "${row.status}" is not one of ${VALID_AGENT_STATUSES.join(', ')}`));
    }

    // active_but_expired
    if (row.status === 'active' && new Date(row.expires_at) < new Date()) {
      findings.push(finding('agents', 'active_but_expired', 'warning', row.id,
        `agent status is "active" but expires_at ${row.expires_at} is in the past`));
    }

    // orphaned_stamp_id
    if (row.stamp_id) {
      const stamp = db.prepare('SELECT id FROM stamps WHERE id = ?').get(row.stamp_id);
      if (!stamp) {
        findings.push(finding('agents', 'orphaned_stamp_id', 'error', row.id,
          `stamp_id "${row.stamp_id}" does not exist in stamps table`));
      }
    }

    // endorsement_count_mismatch
    const actualCount = db.prepare('SELECT COUNT(*) as count FROM endorsements WHERE agent_id = ?').get(row.id).count;
    if (row.endorsement_count !== actualCount) {
      findings.push(finding('agents', 'endorsement_count_mismatch', 'warning', row.id,
        `endorsement_count is ${row.endorsement_count} but actual endorsements count is ${actualCount}`));
    }

    // invalid JSON for capabilities
    if (row.capabilities) {
      try { JSON.parse(row.capabilities); } catch {
        findings.push(finding('agents', 'invalid_capabilities_json', 'error', row.id,
          'capabilities column is not valid JSON'));
      }
    }

    // invalid JSON for protocols
    if (row.protocols) {
      try { JSON.parse(row.protocols); } catch {
        findings.push(finding('agents', 'invalid_protocols_json', 'error', row.id,
          'protocols column is not valid JSON'));
      }
    }

    // invalid JSON for metadata
    if (row.metadata) {
      try { JSON.parse(row.metadata); } catch {
        findings.push(finding('agents', 'invalid_metadata_json', 'error', row.id,
          'metadata column is not valid JSON'));
      }
    }
  }

  return findings;
}

// ─── Endorsements ───────────────────────────────────────────────────────────

function runEndorsementsChecks(db) {
  const findings = [];
  const rows = db.prepare('SELECT * FROM endorsements').all();

  for (const row of rows) {
    // invalid_wallet_address
    if (!WALLET_REGEX.test(row.endorser_wallet)) {
      findings.push(finding('endorsements', 'invalid_wallet_address', 'error', row.id,
        `endorser_wallet "${row.endorser_wallet}" does not match expected format`));
    }

    // orphaned_agent_id
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(row.agent_id);
    if (!agent) {
      findings.push(finding('endorsements', 'orphaned_agent_id', 'error', row.id,
        `agent_id "${row.agent_id}" does not exist in agents table`));
    }

    // invalid_id_prefix
    if (!row.id.startsWith('end_')) {
      findings.push(finding('endorsements', 'invalid_id_prefix', 'warning', row.id,
        `id "${row.id}" does not start with "end_"`));
    }
  }

  return findings;
}

// ─── Wishes ─────────────────────────────────────────────────────────────────

function runWishesChecks(db) {
  const findings = [];
  const rows = db.prepare('SELECT * FROM wishes').all();

  for (const row of rows) {
    // invalid_wallet_address
    if (!WALLET_REGEX.test(row.wallet_address)) {
      findings.push(finding('wishes', 'invalid_wallet_address', 'error', row.id,
        `wallet_address "${row.wallet_address}" does not match expected format`));
    }

    // invalid_category
    if (row.category && !VALID_WISH_CATEGORIES.includes(row.category)) {
      findings.push(finding('wishes', 'invalid_category', 'error', row.id,
        `category "${row.category}" is not one of ${VALID_WISH_CATEGORIES.join(', ')}`));
    }

    // granted_without_timestamp
    if (row.granted && !row.granted_at) {
      findings.push(finding('wishes', 'granted_without_timestamp', 'warning', row.id,
        'wish is marked as granted but granted_at is null'));
    }

    // orphaned_agent_id
    if (row.agent_id) {
      const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(row.agent_id);
      if (!agent) {
        findings.push(finding('wishes', 'orphaned_agent_id', 'warning', row.id,
          `agent_id "${row.agent_id}" does not exist in agents table`));
      }
    }

    // invalid_id_prefix
    if (!row.id.startsWith('wish_')) {
      findings.push(finding('wishes', 'invalid_id_prefix', 'warning', row.id,
        `id "${row.id}" does not start with "wish_"`));
    }
  }

  return findings;
}

// ─── Transactions ───────────────────────────────────────────────────────────

function runTransactionsChecks(db) {
  const findings = [];
  const rows = db.prepare('SELECT * FROM transactions').all();

  for (const row of rows) {
    // invalid_id_prefix
    if (!row.id.startsWith('txn_')) {
      findings.push(finding('transactions', 'invalid_id_prefix', 'warning', row.id,
        `id "${row.id}" does not start with "txn_"`));
    }

    // unknown_action
    if (!VALID_ACTIONS.includes(row.action)) {
      findings.push(finding('transactions', 'unknown_action', 'warning', row.id,
        `action "${row.action}" is not a recognized action`));
    }
  }

  return findings;
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

function runWebhooksChecks(db) {
  const findings = [];
  const rows = db.prepare('SELECT * FROM webhooks').all();

  for (const row of rows) {
    // invalid_wallet_address
    if (!WALLET_REGEX.test(row.wallet_address)) {
      findings.push(finding('webhooks', 'invalid_wallet_address', 'error', row.id,
        `wallet_address "${row.wallet_address}" does not match expected format`));
    }

    // invalid_events_json
    let events;
    try {
      events = JSON.parse(row.events);
    } catch {
      findings.push(finding('webhooks', 'invalid_events_json', 'error', row.id,
        'events column is not valid JSON'));
      continue;
    }

    // unknown_event_type
    if (Array.isArray(events)) {
      for (const evt of events) {
        if (!VALID_WEBHOOK_EVENTS.includes(evt)) {
          findings.push(finding('webhooks', 'unknown_event_type', 'warning', row.id,
            `event "${evt}" is not a recognized webhook event`));
        }
      }
    }

    // invalid_url
    try {
      new URL(row.url);
    } catch {
      findings.push(finding('webhooks', 'invalid_url', 'error', row.id,
        `url "${row.url}" is not a valid URL`));
    }
  }

  return findings;
}

// ─── Heartbeat Log ──────────────────────────────────────────────────────────

function runHeartbeatChecks(db) {
  const findings = [];

  // excessive_heartbeats: agents with more than 10,000 heartbeat entries
  const excessive = db.prepare(
    'SELECT agent_id, COUNT(*) as cnt FROM heartbeat_log GROUP BY agent_id HAVING cnt > 10000'
  ).all();

  for (const row of excessive) {
    findings.push(finding('heartbeat_log', 'excessive_heartbeats', 'warning', row.agent_id,
      `agent has ${row.cnt} heartbeat log entries (threshold: 10000)`));
  }

  return findings;
}

// ─── API Hits ───────────────────────────────────────────────────────────────

function runApiHitsChecks(db) {
  const findings = [];

  // table_too_large
  const rowCount = db.prepare('SELECT COUNT(*) as cnt FROM api_hits').get().cnt;
  if (rowCount > 1000000) {
    findings.push(finding('api_hits', 'table_too_large', 'warning', null,
      `api_hits has ${rowCount} rows (threshold: 1,000,000)`));
  }

  // stale_rows — rows older than 90 days
  const staleCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM api_hits WHERE created_at < datetime('now', '-90 days')"
  ).get().cnt;
  if (staleCount > 0) {
    findings.push(finding('api_hits', 'stale_rows', 'info', null,
      `${staleCount} rows are older than 90 days and could be archived`));
  }

  return findings;
}

// ─── Cross-Table Checks ────────────────────────────────────────────────────

function runCrossTableChecks(db) {
  const findings = [];

  // orphaned_heartbeat — heartbeat_log entries whose agent_id has no matching agent
  const orphanedHeartbeats = db.prepare(`
    SELECT hl.agent_id, COUNT(*) as cnt
    FROM heartbeat_log hl
    LEFT JOIN agents a ON hl.agent_id = a.id
    WHERE a.id IS NULL
    GROUP BY hl.agent_id
  `).all();

  for (const row of orphanedHeartbeats) {
    findings.push(finding('heartbeat_log', 'orphaned_heartbeat', 'error', row.agent_id,
      `${row.cnt} heartbeat entries reference non-existent agent "${row.agent_id}"`));
  }

  // orphaned_endorsement — endorsements whose agent_id has no matching agent
  const orphanedEndorsements = db.prepare(`
    SELECT e.id, e.agent_id
    FROM endorsements e
    LEFT JOIN agents a ON e.agent_id = a.id
    WHERE a.id IS NULL
  `).all();

  for (const row of orphanedEndorsements) {
    findings.push(finding('endorsements', 'orphaned_endorsement', 'error', row.id,
      `endorsement references non-existent agent "${row.agent_id}"`));
  }

  // stale_cooldown — cooldown entries older than their cooldown period
  // free_stamp_cooldown: 7-day cooldown
  const staleFreeStamp = db.prepare(
    "SELECT wallet_address FROM free_stamp_cooldown WHERE last_free_mint < datetime('now', '-7 days')"
  ).all();
  for (const row of staleFreeStamp) {
    findings.push(finding('free_stamp_cooldown', 'stale_cooldown', 'info', row.wallet_address,
      'cooldown entry is past the 7-day window and can be cleaned up'));
  }

  // free_registration_cooldown: 30-day cooldown
  const staleFreeReg = db.prepare(
    "SELECT wallet_address FROM free_registration_cooldown WHERE last_free_registration < datetime('now', '-30 days')"
  ).all();
  for (const row of staleFreeReg) {
    findings.push(finding('free_registration_cooldown', 'stale_cooldown', 'info', row.wallet_address,
      'cooldown entry is past the 30-day window and can be cleaned up'));
  }

  return findings;
}

// ─── Full Report ────────────────────────────────────────────────────────────

function runFullReport(db) {
  const allFindings = [
    ...runStampsChecks(db),
    ...runAgentsChecks(db),
    ...runEndorsementsChecks(db),
    ...runWishesChecks(db),
    ...runTransactionsChecks(db),
    ...runWebhooksChecks(db),
    ...runHeartbeatChecks(db),
    ...runApiHitsChecks(db),
    ...runCrossTableChecks(db),
  ];

  // Aggregate by severity
  const by_severity = { error: 0, warning: 0, info: 0 };
  for (const f of allFindings) {
    by_severity[f.severity] = (by_severity[f.severity] || 0) + 1;
  }

  // Aggregate by table
  const by_table = {};
  for (const f of allFindings) {
    by_table[f.table] = (by_table[f.table] || 0) + 1;
  }

  // Row counts for all 10 tables
  const TABLE_NAMES = [
    'stamps', 'agents', 'endorsements', 'wishes', 'transactions',
    'heartbeat_log', 'free_stamp_cooldown', 'free_registration_cooldown',
    'webhooks', 'api_hits',
  ];
  const row_counts = {};
  for (const name of TABLE_NAMES) {
    row_counts[name] = db.prepare(`SELECT COUNT(*) as cnt FROM ${name}`).get().cnt;
  }

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_findings: allFindings.length,
      by_severity,
      by_table,
      row_counts,
    },
    findings: allFindings,
  };
}

module.exports = {
  VALID_TIERS,
  WALLET_REGEX,
  VALID_AGENT_CATEGORIES,
  VALID_WISH_CATEGORIES,
  VALID_AGENT_STATUSES,
  VALID_ACTIONS,
  VALID_WEBHOOK_EVENTS,
  finding,
  runStampsChecks,
  runAgentsChecks,
  runEndorsementsChecks,
  runWishesChecks,
  runTransactionsChecks,
  runWebhooksChecks,
  runHeartbeatChecks,
  runApiHitsChecks,
  runCrossTableChecks,
  runFullReport,
};
