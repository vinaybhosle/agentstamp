#!/usr/bin/env node
/**
 * AgentStamp — Database Quality Check CLI
 *
 * Usage:
 *   node scripts/db-quality-check.js                  # Full report (stdout JSON)
 *   node scripts/db-quality-check.js --summary        # Summary only
 *   node scripts/db-quality-check.js --fix            # Auto-fix safe issues
 *   node scripts/db-quality-check.js --table stamps   # Check single table
 */
require('dotenv').config();
const Database = require('better-sqlite3');
const { runFullReport, runStampsChecks, runAgentsChecks, runEndorsementsChecks, runWishesChecks, runTransactionsChecks, runWebhooksChecks, runHeartbeatChecks, runApiHitsChecks, runCrossTableChecks } = require('../src/dataQualityChecks');

// Use DB_PATH directly — don't import config.js which requires WALLET_ADDRESS
const dbPath = process.env.DB_PATH || './data/agentstamp.db';

const args = process.argv.slice(2);
const summaryOnly = args.includes('--summary');
const autoFix = args.includes('--fix');
const tableFlag = args.indexOf('--table');
const singleTable = tableFlag !== -1 ? args[tableFlag + 1] : null;

const db = new Database(dbPath, { readonly: !autoFix });

if (autoFix) {
  console.error('[db-quality] Running auto-fix...');
  const now = new Date().toISOString();

  const fixedAgents = db.prepare("UPDATE agents SET status = 'expired' WHERE expires_at < ? AND status = 'active'").run(now);
  console.error(`  Fixed ${fixedAgents.changes} agents with active status past expiry`);

  const fixedStamps = db.prepare("UPDATE stamps SET revoked = 1 WHERE expires_at < ? AND revoked = 0").run(now);
  console.error(`  Fixed ${fixedStamps.changes} expired stamps not marked as revoked`);

  const agents = db.prepare('SELECT id FROM agents').all();
  let fixedCounts = 0;
  for (const a of agents) {
    const actual = db.prepare('SELECT COUNT(*) as c FROM endorsements WHERE agent_id = ?').get(a.id).c;
    const result = db.prepare('UPDATE agents SET endorsement_count = ? WHERE id = ? AND endorsement_count != ?').run(actual, a.id, actual);
    fixedCounts += result.changes;
  }
  console.error(`  Fixed ${fixedCounts} endorsement count mismatches`);

  const oldHits = db.prepare("DELETE FROM api_hits WHERE created_at < datetime('now', '-90 days')").run();
  console.error(`  Cleaned ${oldHits.changes} api_hits rows older than 90 days`);

  console.error('[db-quality] Auto-fix complete.\n');
}

let report;
if (singleTable) {
  const checkMap = {
    stamps: runStampsChecks,
    agents: runAgentsChecks,
    endorsements: runEndorsementsChecks,
    wishes: runWishesChecks,
    transactions: runTransactionsChecks,
    webhooks: runWebhooksChecks,
    heartbeat_log: runHeartbeatChecks,
    api_hits: runApiHitsChecks,
  };
  const fn = checkMap[singleTable];
  if (!fn) {
    console.error(`Unknown table: ${singleTable}. Valid: ${Object.keys(checkMap).join(', ')}`);
    process.exit(1);
  }
  const findings = fn(db);
  report = { generated_at: new Date().toISOString(), table: singleTable, findings };
} else {
  report = runFullReport(db);
}

if (summaryOnly && report.summary) {
  console.log(JSON.stringify(report.summary, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}

const errorCount = report.summary?.by_severity?.error || report.findings?.filter(f => f.severity === 'error').length || 0;
process.exit(errorCount > 0 ? 1 : 0);
