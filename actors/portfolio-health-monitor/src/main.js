// Actor entry point.
//
// Portfolio health monitor — production observability for a fleet of actors.
// Runs a tiny smoke check against each configured actor (Actor.call with a
// minimal input), verifies the run succeeded and returned data, measures
// duration, and reports healthy/degraded/failing/error per actor plus a fleet
// summary. Designed to run on a daily Schedule; pair with the webhook-notifier
// to alert a channel when SUMMARY.allHealthy is false.

import { Actor } from "apify";
import { stableSort, cleanRow } from "./lib/reliability.js";
import { resolveChecks, evaluateRun, evaluateActorMetadata, summarize } from "./lib/health.js";

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { checks, bad } = resolveChecks(input);
if (bad.length) console.warn(`Ignoring ${bad.length} invalid check(s): ${bad.join(", ")}`);

const concurrent = Math.min(4, Math.max(1, input.concurrency ?? 2));
const rows = [];

async function auditActor(actorRef) {
  try {
    const actor = await Actor.apifyClient.actor(actorRef).get();
    if (actor?.isPublic === false && !(input.includePrivate ?? false)) return;
    const verdict = evaluateActorMetadata(actor);
    const actorId = actor
      ? (actor.username ? `${actor.username}/${actor.name}` : actor.name ?? actorRef)
      : actorRef;
    rows.push(cleanRow({
      checkType: "metadata",
      actorId,
      actorObjectId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      status: verdict.status,
      reason: verdict.reason,
      notice: verdict.notice,
      isPublic: actor?.isPublic ?? null,
      isDeprecated: actor?.isDeprecated ?? null,
      modifiedAt: actor?.modifiedAt ?? null,
      checkedAt: new Date().toISOString(),
    }, { dropEmpty: false }));
    const icon = verdict.status === "healthy" ? "✓" : verdict.status === "degraded" ? "▲" : "✗";
    console.log(`${icon} ${actorId} — ${verdict.status}${verdict.reason ? ` (${verdict.reason})` : ""}`);
  } catch (err) {
    rows.push(cleanRow({
      checkType: "metadata", actorId: actorRef, status: "error",
      reason: err.message?.slice(0, 200) ?? "metadata request failed",
      checkedAt: new Date().toISOString(),
    }, { dropEmpty: false }));
  }
}

if (input.auditPortfolio ?? true) {
  let actorRefs = Array.isArray(input.actorIds)
    ? input.actorIds.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (!actorRefs.length) {
    const listed = await Actor.apifyClient.actors().list({ limit: 1000, my: true });
    actorRefs = listed.items.map((actor) => actor.id);
  }
  const queue = [...actorRefs];
  await Promise.all(Array.from({ length: concurrent }, async () => {
    while (queue.length) {
      const actorRef = queue.shift();
      if (actorRef) await auditActor(actorRef);
    }
  }));
}

async function runCheck(check) {
  const started = Date.now();
  let run = null, itemCount = 0, errorMessage = null;
  try {
    run = await Actor.call(check.actorId, check.input, {
      timeout: check.timeoutSecs,
      memory: input.memoryMbytes ?? 1024,
    });
    if (run?.defaultDatasetId) {
      // Smoke runs are tiny; count actual items (getInfo/total can lag right
      // after a run finishes, which would false-flag a healthy actor).
      const ds = await Actor.openDataset(run.defaultDatasetId);
      const { items } = await ds.getData({ limit: 1000 });
      itemCount = items?.length ?? 0;
    }
  } catch (err) {
    errorMessage = err.message?.slice(0, 200) ?? "unknown error";
  }
  const durationMs = Date.now() - started;
  const verdict = evaluateRun(check, run, itemCount, durationMs, errorMessage);
  const row = {
    checkType: "smoke",
    actorId: check.actorId,
    status: verdict.status,
    reason: verdict.reason,
    runStatus: run?.status ?? null,
    runId: run?.id ?? null,
    items: itemCount,
    expectedMinItems: check.expectMinItems,
    durationMs,
    checkedAt: new Date().toISOString(),
  };
  rows.push(row);
  const icon = { healthy: "✓", degraded: "▲", failing: "✗", error: "✗" }[verdict.status];
  console.log(`${icon} ${check.actorId} — ${verdict.status}${verdict.reason ? ` (${verdict.reason})` : ""} — ${itemCount} item(s), ${Math.round(durationMs / 1000)}s`);
}

// Simple worker pool.
if (input.runSmokeChecks ?? false) {
  const queue = [...checks];
  await Promise.all(Array.from({ length: concurrent }, async () => {
    while (queue.length) {
      const check = queue.shift();
      if (check) await runCheck(check);
    }
  }));
}

const statusOrder = { error: 0, failing: 1, degraded: 2, healthy: 3 };
const results = stableSort(rows.map((r) => cleanRow(r, { dropEmpty: false })), {
  by: [{ key: "checkType" }, { key: "actorId" }],
  tieBreakKey: "runId",
}).sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

await Actor.pushData(results);
const report = summarize(rows);
await Actor.setValue("SUMMARY", { ...report, checkedAt: new Date().toISOString() });

// A red fleet makes the monitor run itself FAIL, so a Schedule's built-in
// failure notification fires without any extra wiring.
if (!report.allHealthy && (input.failOnUnhealthy ?? true)) {
  console.error(`\nFLEET UNHEALTHY: ${report.problems.join(" | ")}`);
  await Actor.fail(`${report.failing + report.error} failing/error, ${report.degraded} degraded of ${report.checked} checks. See dataset for details.`);
} else {
  console.log(`\nDone. ${report.healthy}/${report.checked} healthy${report.degraded ? `, ${report.degraded} degraded` : ""}.`);
}

await Actor.exit();
