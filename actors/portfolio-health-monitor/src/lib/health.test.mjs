import { DEFAULT_CHECKS, resolveChecks, evaluateRun, evaluateActorMetadata, summarize } from "./health.js";

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? (pass++, console.log("  ✓ " + name)) : (fail++, console.log("  ✗ " + name)); };

// --- DEFAULT_CHECKS sanity ---
t("has default checks", DEFAULT_CHECKS.length >= 12);
t("every default has valid actorId", DEFAULT_CHECKS.every((c) => /^alaudinburki\/[a-z0-9-]+$/.test(c.actorId)));
t("every default has an input object", DEFAULT_CHECKS.every((c) => c.input && typeof c.input === "object"));
t("default fleet excludes credential/proxy-gated checks", !DEFAULT_CHECKS.some((c) => c.actorId === "alaudinburki/google-trends-full-scraper"));
t("RSS canary uses a stable official release feed", DEFAULT_CHECKS.some((c) => c.input.feedUrls?.[0] === "https://github.com/apify/apify-sdk-js/releases.atom"));

// --- resolveChecks ---
{
  const { checks } = resolveChecks({});
  t("empty input → defaults", checks.length === DEFAULT_CHECKS.length);
  t("defaults normalized with timeout", checks.every((c) => c.timeoutSecs >= 30 && c.expectMinItems >= 0));
}
{
  const { checks, bad } = resolveChecks({ checks: [
    { actorId: "user/actor", input: { x: 1 }, expectMinItems: 3, timeoutSecs: 9999 },
    { actorId: "no-slash" },
    { notAnActor: true },
  ]});
  t("custom check kept", checks.length === 1 && checks[0].expectMinItems === 3);
  t("timeout clamped to 600", checks[0].timeoutSecs === 600);
  t("invalid checks reported", bad.length === 2);
}

// --- evaluateRun ---
const CHECK = { expectMinItems: 2, timeoutSecs: 100 };
t("healthy", evaluateRun(CHECK, { status: "SUCCEEDED" }, 5, 1000).status === "healthy");
t("degraded on low items", (() => { const v = evaluateRun(CHECK, { status: "SUCCEEDED" }, 1, 1000); return v.status === "degraded" && v.reason.includes("expected >= 2"); })());
t("degraded on slow", evaluateRun(CHECK, { status: "SUCCEEDED" }, 5, 90000).status === "degraded");
t("failing on FAILED run", evaluateRun(CHECK, { status: "FAILED" }, 0, 1000).status === "failing");
t("failing on TIMED-OUT", evaluateRun(CHECK, { status: "TIMED-OUT" }, 0, 1000).status === "failing");
t("error on no run", evaluateRun(CHECK, null, 0, 0).status === "error");
t("error carries message", evaluateRun(CHECK, null, 0, 0, "boom").reason === "boom");

// --- evaluateActorMetadata ---
t("metadata healthy with null notice", evaluateActorMetadata({ notice: null, isDeprecated: false }).status === "healthy");
t("metadata NONE notice is healthy", evaluateActorMetadata({ notice: "NONE", isDeprecated: false }).status === "healthy");
t("maintenance notice is failing", (() => {
  const v = evaluateActorMetadata({ notice: "UNDER_MAINTENANCE", isDeprecated: false });
  return v.status === "failing" && v.notice === "UNDER_MAINTENANCE";
})());
t("deprecated actor is degraded", evaluateActorMetadata({ notice: null, isDeprecated: true }).status === "degraded");
t("missing metadata is error", evaluateActorMetadata(null).status === "error");

// --- summarize ---
{
  const rows = [
    { actorId: "a/x", status: "healthy" },
    { actorId: "a/y", status: "degraded", reason: "slow" },
    { actorId: "a/z", status: "failing", reason: "run FAILED" },
  ];
  const s = summarize(rows);
  t("counts", s.healthy === 1 && s.degraded === 1 && s.failing === 1 && s.checked === 3);
  t("not allHealthy", s.allHealthy === false);
  t("problems listed", s.problems.length === 2 && s.problems[1].includes("a/z"));
}
t("all healthy true", summarize([{ actorId: "a/x", status: "healthy" }]).allHealthy === true);

console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
