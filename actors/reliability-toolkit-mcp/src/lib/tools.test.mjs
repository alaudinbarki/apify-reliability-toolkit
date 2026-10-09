import {
  TOOLS, getTool, toInputSchema, toMcpTool, validateArgs, buildActorInput,
} from "./tools.js";

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? (pass++, console.log("  ✓ " + name)) : (fail++, console.log("  ✗ " + name)); };

// --- registry integrity ---
t("has tools", TOOLS.length >= 9);
t("every tool has name/actorId/description/build", TOOLS.every((x) => x.name && x.actorId && x.description && typeof x.build === "function"));
t("names unique", new Set(TOOLS.map((x) => x.name)).size === TOOLS.length);
t("actorIds are username/name", TOOLS.every((x) => /^alaudinburki\/[a-z0-9-]+$/.test(x.actorId)));

// --- getTool ---
t("getTool found", getTool("verify_emails").actorId.includes("email-verifier"));
t("getTool missing → null", getTool("nope") === null);

// --- toInputSchema / toMcpTool ---
{
  const s = toInputSchema(getTool("amazon_products"));
  t("schema type object", s.type === "object");
  t("required extracted", s.required.includes("productUrls"));
  t("required flag stripped from property", !("required" in s.properties.productUrls));
  t("property keeps type", s.properties.productUrls.type === "array");
  const m = toMcpTool(getTool("amazon_products"));
  t("mcp tool shape", m.name === "amazon_products" && m.inputSchema.type === "object" && typeof m.description === "string");
}

// --- validateArgs ---
{
  const tool = getTool("amazon_products");
  t("missing required fails", !validateArgs(tool, {}).ok);
  t("empty array required fails", !validateArgs(tool, { productUrls: [] }).ok);
  t("valid passes", validateArgs(tool, { productUrls: ["https://a"] }).ok);
  t("wrong type array fails", !validateArgs(tool, { productUrls: "x" }).ok);
  t("integer type checked", !validateArgs(tool, { productUrls: ["https://a"], maxItems: "ten" }).ok);
}

// --- buildActorInput transforms ---
{
  const amazon = buildActorInput(getTool("amazon_products"), { productUrls: ["https://a", "https://b"] });
  t("amazon urls wrapped as {url}", amazon.productUrls[0].url === "https://a" && amazon.productUrls.length === 2);
  t("undefined maxItems dropped", !("maxItems" in amazon));

  const jobs = buildActorInput(getTool("monitor_jobs"), { boardUrls: ["https://c"] });
  t("jobs urls wrapped", jobs.boardUrls[0].url === "https://c");
  t("jobs default returnMode", jobs.returnMode === "new");

  const trends = buildActorInput(getTool("google_trends_daily"), {});
  t("trends default geo US", trends.geos[0] === "US");

  const pm = buildActorInput(getTool("prediction_markets"), { query: "btc" });
  t("prediction default sources both", pm.sources.length === 2 && pm.query === "btc");

  const full = buildActorInput(getTool("google_trends_full"), { keywords: ["a", "b"] });
  t("trends-full defaults timeRange", full.timeRange === "today 12-m" && full.keywords.length === 2);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
