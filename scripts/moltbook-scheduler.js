#!/usr/bin/env node
/**
 * Moltbook Scheduler — PM2-managed daemon
 * Runs moltbook-engage.sh modes on schedule using node-cron-like intervals.
 * Sends output to logs directory. Always exits cleanly to prevent PM2 restarts.
 */

const { execFile } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'moltbook-engage.sh');
const LOG_DIR = path.join(__dirname, 'logs');

// Schedule config (IST — runs in local time)
const SCHEDULES = {
  dmcheck:   { intervalMs: 30 * 60 * 1000 },                           // every 30 min
  engage:    { hours: [9, 12, 15, 18, 21], minute: 0 },                // 5x daily
  intel:     { hours: [11], minute: 0 },                                // daily 11am
  publish:   { hours: [12], minute: 30, weekdays: [1, 3, 5] },         // Mon/Wed/Fri
  outreach:  { hours: [14], minute: 30 },                               // daily 2:30pm
  spotlight: { hours: [12], minute: 30, weekdays: [6] },                // Saturday
};

function log(msg) {
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`[${ts}] ${msg}`);
}

function runMode(mode) {
  log(`Starting ${mode}...`);
  execFile('/bin/bash', [SCRIPT, mode], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/vinaybhosle/.local/bin'
    },
    timeout: 10 * 60 * 1000, // 10 min max
  }, (err, stdout, stderr) => {
    if (err) {
      log(`${mode} finished with error: ${err.message}`);
    } else {
      log(`${mode} completed successfully`);
    }
  });
}

// Interval-based schedules (dmcheck)
for (const [mode, config] of Object.entries(SCHEDULES)) {
  if (config.intervalMs) {
    log(`Scheduling ${mode} every ${config.intervalMs / 60000} min`);
    setInterval(() => {
      const hour = new Date().getHours();
      // Only run dmcheck between 9am-10pm IST
      if (mode === 'dmcheck' && (hour < 9 || hour > 22)) {
        return;
      }
      runMode(mode);
    }, config.intervalMs);
  }
}

// Calendar-based schedules — check every minute
setInterval(() => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const weekday = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  for (const [mode, config] of Object.entries(SCHEDULES)) {
    if (config.intervalMs) continue; // skip interval-based

    if (config.hours.includes(hour) && config.minute === minute) {
      if (config.weekdays && !config.weekdays.includes(weekday)) continue;
      runMode(mode);
    }
  }
}, 60 * 1000); // check every 60 seconds

log('Moltbook scheduler started. Modes: ' + Object.keys(SCHEDULES).join(', '));
log('Next dmcheck in 30 min. Calendar jobs checked every minute.');
