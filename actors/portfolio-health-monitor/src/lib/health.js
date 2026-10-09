// Portfolio health-check helpers — pure, tested.
//
// Production observability for a fleet of actors: define smoke checks (actor +
// tiny input + expectations), evaluate results uniformly, and summarize fleet
// health. Running the checks (Actor.call / API reads) lives in main.js.

/** Default smoke checks for this account's no-auth actors. Tiny, cheap inputs. */
export const DEFAULT_CHECKS = [
  { actorId: "alaudinburki/google-trends-rss-reliable", input: { geos: ["US"], maxItems: 3 }, expectMinItems: 1 },
  { actorId: "alaudinburki/prediction-markets-unified", input: { maxItems: 6 }, expectMinItems: 2 },
  { actorId: "alaudinburki/lead-finder-verified-emails", input: { domains: ["apify.com"], maxPagesPerSite: 2, maxLeads: 10 }, expectMinItems: 1 },
  { actorId: "alaudinburki/email-verifier-honest", input: { emails: ["support@apify.com"] }, expectMinItems: 1 },
  { actorId: "alaudinburki/screenshot-reliable", input: { urls: [{ url: "https://example.com" }], fullPage: false }, expectMinItems: 1 },
  { actorId: "alaudinburki/broken-link-checker", input: { startUrls: [{ url: "https://example.com" }], maxPages: 1 }, expectMinItems: 1 },
  { actorId: "alaudinburki/sitemap-url-extractor", input: { siteUrl: "https://www.apify.com", maxUrls: 5 }, expectMinItems: 1 },
  { actorId: "alaudinburki/rss-feed-aggregator", input: { feedUrls: ["https://github.com/apify/apify-sdk-js/releases.atom"], maxItems: 5 }, expectMinItems: 1 },
  { actorId: "alaudinburki/url-metadata-extractor", input: { urls: [{ url: "https://github.com" }] }, expectMinItems: 1 },
  { actorId: "alaudinburki/html-table-extractor", input: { urls: [{ url: "https://en.wikipedia.org/wiki/List_of_largest_companies_by_revenue" }], tableIndex: 0, maxItems: 5 }, expectMinItems: 1 },
  { actorId: "alaudinburki/lead-list-deduplicator", input: { items: [{ email: "a@b.com" }, { email: "A@b.com" }], keyFields: ["email"] }, expectMinItems: 1 },
  { actorId: "alaudinburki/format-converter", input: { outputFormat: "csv", items: [{ a: 1 }] }, expectMinItems: 1 },
  { actorId: "alaudinburki/dataset-profiler", input: { items: [{ a: 1, b: "x" }] }, expectMinItems: 1 },
  { actorId: "alaudinburki/dataset-webhook-notifier", input: { webhookUrl: "https://httpbin.org/post", target: "generic", items: [{ ping: 1 }] }, expectMinItems: 1 },
];

/** Normalise/validate a checks list from input; fall back to defaults. */
export function resolveChecks(input = {}) {
  const raw = Array.isArray(input.checks) && input.checks.length ? input.checks : DEFAULT_CHECKS;
  const checks = [];
  const bad = [];
  for (const c of raw) {
    if (!c || typeof c.actorId !== "string" || !c.actorId.includes("/")) { bad.push(c?.actorId ?? "(missing actorId)"); continue; }
    checks.push({
      actorId: c.actorId.trim(),
      input: c.input && typeof c.input === "object" ? c.input : {},
      expectMinItems: Number.isFinite(c.expectMinItems) ? c.expectMinItems : 1,
      timeoutSecs: Math.min(600, Math.max(30, c.timeoutSecs ?? 300)),
    });
  }
  return { checks, bad };
}

/**
 * Evaluate one smoke-run outcome into a verdict row.
 * status: healthy | degraded (ran but under expectations) | failing | error
 */
export function evaluateRun(check, run, itemCount, durationMs, errorMessage = null) {
  if (errorMessage || !run) {
    return { status: "error", reason: errorMessage ?? "run did not start" };
  }
  if (run.status !== "SUCCEEDED") {
    return { status: "failing", reason: `run ${run.status}` };
  }
  if (itemCount < check.expectMinItems) {
    return { status: "degraded", reason: `only ${itemCount} item(s), expected >= ${check.expectMinItems}` };
  }
  if (durationMs > check.timeoutSecs * 1000 * 0.8) {
    return { status: "degraded", reason: `slow: ${Math.round(durationMs / 1000)}s (limit ${check.timeoutSecs}s)` };
  }
  return { status: "healthy", reason: null };
}

/** Evaluate an Actor object returned by the Apify API without mutating it. */
export function evaluateActorMetadata(actor) {
  if (!actor) return { status: "error", reason: "actor metadata unavailable", notice: null };
  const notice = actor.notice && actor.notice !== "NONE" ? actor.notice : null;
  if (notice === "UNDER_MAINTENANCE") {
    return { status: "failing", reason: "Apify marked this Actor under maintenance", notice };
  }
  if (actor.isDeprecated) {
    return { status: "degraded", reason: "Actor is deprecated", notice };
  }
  return { status: "healthy", reason: null, notice };
}

/** Summarize verdict rows into a fleet report. */
export function summarize(rows) {
  const counts = { healthy: 0, degraded: 0, failing: 0, error: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const worst = rows.filter((r) => r.status !== "healthy").map((r) => `${r.actorId}: ${r.status} (${r.reason})`);
  return {
    checked: rows.length,
    ...counts,
    allHealthy: counts.failing === 0 && counts.error === 0 && counts.degraded === 0,
    problems: worst,
  };
}
