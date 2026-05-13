require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createMeeting } = require('../server/services/teams');

const START_TIME = '2026-05-13T12:00:00+04:00';
const END_TIME   = '2026-05-13T12:20:00+04:00';
const PAIR_COUNT  = 36;
const SPARE_COUNT = 10;
const TOTAL = PAIR_COUNT + SPARE_COUNT;
const PACE_MS = 260;            // ~4 RPS
const RATE_LIMIT_BACKOFF_MS = 30_000;
const MAX_RETRIES_ON_429 = 3;
const OUT_PATH = path.join(__dirname, 'load-test-meetings.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n) => String(n).padStart(2, '0');

function buildJobs() {
  const jobs = [];
  for (let i = 1; i <= PAIR_COUNT; i++) {
    jobs.push({
      type: 'pair',
      number: i,
      label: `Pair #${pad2(i)}`,
      subject: `Engage Load Test — Pair #${pad2(i)} — May 13, 12:00 Dubai`,
    });
  }
  for (let i = 1; i <= SPARE_COUNT; i++) {
    jobs.push({
      type: 'spare',
      number: i,
      label: `SPARE #${pad2(i)}`,
      subject: `Engage Load Test — SPARE #${pad2(i)} — May 13, 12:00 Dubai`,
    });
  }
  return jobs;
}

async function createWithRetry(job) {
  let attempt = 0;
  while (true) {
    try {
      return await createMeeting({
        subject: job.subject,
        startTime: START_TIME,
        endTime: END_TIME,
        attendeeEmails: [],
      });
    } catch (err) {
      const is429 = /HTTP 429/.test(err.message);
      if (is429 && attempt < MAX_RETRIES_ON_429) {
        attempt++;
        console.warn(`  ↳ 429 from Graph; backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s (retry ${attempt}/${MAX_RETRIES_ON_429})`);
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const jobs = buildJobs();
  const results = [];
  let done = 0;

  for (const job of jobs) {
    const { joinUrl, meetingId } = await createWithRetry(job);
    done++;
    results.push({
      type: job.type,
      number: job.number,
      subject: job.subject,
      joinUrl,
      meetingId,
    });
    console.log(`[${done}/${TOTAL}] Created ${job.label}`);
    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
    if (done < TOTAL) await sleep(PACE_MS);
  }

  console.log(`\nWrote ${results.length} meetings to ${OUT_PATH}\n`);
  console.log('type,number,joinUrl');
  for (const r of results) {
    console.log(`${r.type},${r.number},${r.joinUrl}`);
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
