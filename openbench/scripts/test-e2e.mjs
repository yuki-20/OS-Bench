#!/usr/bin/env node
// End-to-end product test.
//
// Drives the full operator lifecycle against a running API:
//   login → upload doc → compile protocol (AI) → publish → create run →
//   preflight → start → step actions → record deviation → generate handover →
//   resolve deviation.
//
// Run this with the console open at http://localhost:4028/run-monitor in
// another window — every step lights up live via SSE.
//
// Usage:
//   node openbench/scripts/test-e2e.mjs                     # uses sample SOP
//   node openbench/scripts/test-e2e.mjs path/to/sop.pdf
//
// Requires: Node 18+, a running API, and a working Anthropic key set on the
// console's API Keys page (or ANTHROPIC_API_KEY env on the API container).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.OPENBENCH_API || 'http://localhost:8000';
const EMAIL = process.env.OPENBENCH_EMAIL || 'admin@demo.lab';
const PASSWORD = process.env.OPENBENCH_PASSWORD || 'Bench!Demo1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(process.argv[2] || `${__dirname}/../sample-data/sop.md`);

// --- pretty output ---------------------------------------------------------
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};
const step = (s) => console.log(`\n${C.bold}${C.cyan}▶ ${s}${C.reset}`);
const ok = (s)   => console.log(`  ${C.green}✓${C.reset} ${s}`);
const warn = (s) => console.log(`  ${C.yellow}!${C.reset} ${s}`);
const fail = (s) => { console.error(`  ${C.red}✗${C.reset} ${s}`); process.exit(1); };

// --- auth ------------------------------------------------------------------
let TOKEN = '';
let ORG_ID = '';

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Org-Id': ORG_ID,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw Object.assign(new Error(`${res.status} ${detail}`), { status: res.status, body: detail });
  }
  return text ? JSON.parse(text) : null;
}

async function uploadFile(path) {
  const buf = await readFile(path);
  const fd = new FormData();
  fd.set('file', new Blob([buf]), basename(path));
  fd.set('title', basename(path));
  fd.set('doc_type', 'sop');
  const res = await fetch(`${API}/api/documents/upload-direct`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'X-Org-Id': ORG_ID },
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- main ------------------------------------------------------------------
(async () => {
  if (!existsSync(docPath)) fail(`Document not found: ${docPath}`);

  // 1. login
  step(`Login as ${EMAIL}`);
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) fail(`Login failed: ${await loginRes.text()}`);
  ({ access_token: TOKEN } = await loginRes.json());
  const me = await api('GET', '/api/auth/me');
  ORG_ID = me.memberships[0].org_id;
  ok(`Logged in as ${me.display_name} · ${me.memberships[0].org_name} (${me.memberships[0].role})`);

  // 2. upload document
  step(`Upload document: ${basename(docPath)}`);
  const doc = await uploadFile(docPath);
  ok(`Document ${doc.id} stored (${doc.chunk_count ?? 0} chunks indexed)`);

  // 3. compile protocol (AI)
  step('Compile protocol from document (Anthropic — usually 30-60s)');
  const t0 = Date.now();
  const draft = await api('POST', '/api/protocol-drafts/compile', {
    document_ids: [doc.id],
    name: `E2E Test — ${basename(docPath)}`,
  });
  ok(`Compiled draft ${draft.id} in ${Math.round((Date.now() - t0) / 1000)}s — ${draft.steps.length} steps`);
  if (draft.summary) console.log(`     summary: ${String(draft.summary).slice(0, 140)}…`);

  // 4. publish
  step('Publish protocol draft');
  await api('POST', `/api/protocol-drafts/${draft.id}/publish`);
  ok(`Published — visible at http://localhost:4028/protocols`);

  // 5. create run
  step('Create run from protocol');
  const run = await api('POST', '/api/runs', {
    protocol_version_id: draft.id,
    device_id: `e2e-${Date.now()}`,
  });
  ok(`Run ${run.id} created (status: ${run.status})`);
  console.log(`  ${C.cyan}Open the console: http://localhost:4028/run-detail?id=${run.id}${C.reset}`);
  await sleep(2000);

  // 6. preflight + start
  step('Preflight + start run');
  await api('POST', `/api/runs/${run.id}/preflight`);
  ok('Preflight');
  await sleep(1000);
  const started = await api('POST', `/api/runs/${run.id}/start`);
  if (started.status !== 'active') fail(`Start failed: ${JSON.stringify(started)}`);
  ok('Run is now ACTIVE — watch the live badge in the console');
  await sleep(2000);

  // 7. walk through three steps
  step(`Walk through 3 of ${draft.steps.length} steps (start → complete)`);
  const stepsToRun = draft.steps.slice(0, 3);
  let i = 0;
  for (const s of stepsToRun) {
    i++;
    console.log(`  step ${i}/${draft.steps.length} — ${s.title || s.step_key}`);
    await api('POST', `/api/runs/${run.id}/steps/${s.id}/start`, {
      idempotency_key: `e2e-start-${i}-${run.id}`,
    });
    await sleep(800);
    await api('POST', `/api/runs/${run.id}/steps/${s.id}/complete`, {
      idempotency_key: `e2e-complete-${i}-${run.id}`,
      override_block: true,
      confirmations: { e2e: true },
    });
    await sleep(800);
  }
  ok('Three steps completed — Events tab now has 6+ entries');

  // 8. measurement + deviation
  step('Record a measurement and a deviation');
  await api('POST', `/api/runs/${run.id}/measurements`, {
    step_id: stepsToRun[0]?.id ?? null,
    key: 'ph',
    value: 7.42,
    unit: 'pH',
  });
  ok('Measurement recorded (pH 7.42)');

  const dev = await api('POST', `/api/runs/${run.id}/deviations`, {
    severity: 'moderate',
    title: 'End-to-end test deviation',
    description:
      'Synthetic deviation injected by test-e2e.mjs to verify the deviation pipeline.',
  });
  ok(`Deviation ${dev.id} logged — http://localhost:4028/deviation-reports`);
  await sleep(2000);

  // 9. handover (AI)
  step('Generate AI handover report (Anthropic, ~30s)');
  try {
    const t = Date.now();
    const hand = await api('POST', `/api/runs/${run.id}/handover/generate`);
    if (hand?.summary) {
      ok(`Handover generated in ${Math.round((Date.now() - t) / 1000)}s — ${String(hand.summary).slice(0, 100)}…`);
    } else {
      warn(`Handover returned no summary — payload: ${JSON.stringify(hand).slice(0, 200)}`);
    }
  } catch (e) {
    warn(`Handover generation failed (key configured?): ${e.message.slice(0, 200)}`);
  }

  // 10. resolve deviation
  step('Resolve the deviation');
  const resolved = await api('POST', `/api/deviations/${dev.id}/resolve`, {
    resolution_state: 'resolved',
    note: 'Verified during E2E test — no production impact.',
  });
  if (resolved.resolution_state === 'resolved') ok('Deviation resolved');

  // summary
  console.log(`\n${C.bold}${C.green}━━━ End-to-end test complete ━━━${C.reset}`);
  console.log(`Document  : ${doc.id}`);
  console.log(`Protocol  : ${draft.protocol_id}`);
  console.log(`Version   : ${draft.id}`);
  console.log(`Run       : ${run.id}`);
  console.log(`Deviation : ${dev.id}`);
  console.log('\nVerify in the console:');
  console.log('  • http://localhost:4028/console-dashboard');
  console.log('  • http://localhost:4028/run-monitor');
  console.log(`  • http://localhost:4028/run-detail?id=${run.id}`);
  console.log('  • http://localhost:4028/deviation-reports');
  console.log('  • http://localhost:4028/audit-log');
})().catch((err) => {
  console.error(`\n${C.red}${C.bold}Test failed:${C.reset} ${err.stack || err.message}`);
  process.exit(1);
});
