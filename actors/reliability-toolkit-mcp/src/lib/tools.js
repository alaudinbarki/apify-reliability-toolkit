// The Reliability Toolkit — our deployed actors exposed as MCP tools.
//
// The angle from docs/CATEGORIES.md: MCP is the fastest-growing surface, has
// near-empty competition, is PPE-monetizable, and is the one MCP revenue route
// that works from Pakistan (Apify hosts + bills). This server wraps actors we
// already ship — near-zero new logic, a whole new distribution channel
// (Claude/Cursor/agents). This file is the pure, tested registry; the server
// and the actor calls live in main.js.

/**
 * Each tool maps to one deployed actor. `args` is a compact declaration used to
 * generate the MCP JSON input schema AND to validate/transform calls. `build`
 * turns validated tool args into the actor's input object.
 */
export const TOOLS = [
  {
    name: "amazon_products",
    actorId: "alaudinburki/amazon-product-scraper-reliable",
    description: "Scrape Amazon product data (title, price, rating, reviews) with per-field reliability reporting. Give product URLs.",
    args: {
      productUrls: { type: "array", items: { type: "string" }, required: true, description: "Amazon product URLs (/dp/ASIN)." },
      maxItems: { type: "integer", description: "Max results." },
    },
    build: (a) => ({ productUrls: a.productUrls.map((url) => ({ url })), maxItems: a.maxItems }),
  },
  {
    name: "verify_emails",
    actorId: "alaudinburki/email-verifier-honest",
    description: "Verify email addresses without sending mail: syntax, MX, disposable, role account, typo suggestions.",
    args: {
      emails: { type: "array", items: { type: "string" }, required: true, description: "Emails to verify." },
      onlyStatus: { type: "string", description: "Filter to one status (valid/risky/undeliverable) or 'all'." },
    },
    build: (a) => ({ emails: a.emails, onlyStatus: a.onlyStatus ?? "all" }),
  },
  {
    name: "monitor_jobs",
    actorId: "alaudinburki/job-change-monitor",
    description: "Return only new/changed job postings on career pages since the last run.",
    args: {
      boardUrls: { type: "array", items: { type: "string" }, required: true, description: "Career/job page URLs." },
      returnMode: { type: "string", description: "new | changed | removed | all." },
    },
    build: (a) => ({ boardUrls: a.boardUrls.map((url) => ({ url })), returnMode: a.returnMode ?? "new" }),
  },
  {
    name: "google_trends_daily",
    actorId: "alaudinburki/google-trends-rss-reliable",
    description: "Today's trending searches for given countries, from Google's RSS feed (no rate limits).",
    args: {
      geos: { type: "array", items: { type: "string" }, description: "Two-letter country codes, e.g. US, GB." },
      maxItems: { type: "integer", description: "Max results." },
    },
    build: (a) => ({ geos: a.geos ?? ["US"], maxItems: a.maxItems }),
  },
  {
    name: "google_trends_full",
    actorId: "alaudinburki/google-trends-full-scraper",
    description: "Interest over time, related queries, and interest by region for up to 5 compared keywords.",
    args: {
      keywords: { type: "array", items: { type: "string" }, required: true, description: "Up to 5 keywords." },
      geo: { type: "string", description: "Country/region code, empty = worldwide." },
      timeRange: { type: "string", description: "e.g. today 12-m, today 5-y." },
    },
    build: (a) => ({ keywords: a.keywords, geo: a.geo ?? "", timeRange: a.timeRange ?? "today 12-m" }),
  },
  {
    name: "ai_brand_visibility",
    actorId: "alaudinburki/ai-brand-visibility-tracker",
    description: "Check whether AI assistants mention a brand vs competitors and which sources they cite. Requires an LLM API key.",
    args: {
      brandName: { type: "string", required: true, description: "Brand to track." },
      competitors: { type: "array", items: { type: "string" }, description: "Competitor names." },
      topic: { type: "string", description: "Topic to auto-generate questions from." },
      openaiApiKey: { type: "string", description: "OpenAI key (or provide another provider's)." },
    },
    build: (a) => ({ brandName: a.brandName, competitors: a.competitors ?? [], topic: a.topic ?? "", openaiApiKey: a.openaiApiKey }),
  },
  {
    name: "find_contacts",
    actorId: "alaudinburki/lead-finder-verified-emails",
    description: "Find contact emails/phones/socials on company websites, with every email verified against live DNS.",
    args: {
      domains: { type: "array", items: { type: "string" }, required: true, description: "Company domains." },
      maxPagesPerSite: { type: "integer", description: "Pages to scan per site." },
    },
    build: (a) => ({ domains: a.domains, maxPagesPerSite: a.maxPagesPerSite ?? 5 }),
  },
  {
    name: "product_hunt",
    actorId: "alaudinburki/product-hunt-scraper",
    description: "Fetch Product Hunt launches (votes, makers, topics) via the official API. Requires a PH developer token.",
    args: {
      developerToken: { type: "string", required: true, description: "Product Hunt developer token." },
      order: { type: "string", description: "RANKING | NEWEST | VOTES | FEATURED_AT." },
      topic: { type: "string", description: "Topic slug, e.g. artificial-intelligence." },
    },
    build: (a) => ({ developerToken: a.developerToken, order: a.order ?? "RANKING", topic: a.topic ?? "" }),
  },
  {
    name: "prediction_markets",
    actorId: "alaudinburki/prediction-markets-unified",
    description: "Live prices/volume from Polymarket and Kalshi in one unified schema. No keys needed.",
    args: {
      query: { type: "string", description: "Keyword filter over question/category." },
      sources: { type: "array", items: { type: "string" }, description: "polymarket, kalshi, or both." },
      maxItems: { type: "integer", description: "Max markets." },
    },
    build: (a) => ({ query: a.query ?? "", sources: a.sources ?? ["polymarket", "kalshi"], maxItems: a.maxItems ?? 100 }),
  },
];

/** Look up a tool by name. */
export function getTool(name) {
  return TOOLS.find((t) => t.name === name) ?? null;
}

/** Build the MCP inputSchema (JSON Schema) for a tool from its compact args. */
export function toInputSchema(tool) {
  const properties = {};
  const required = [];
  for (const [key, def] of Object.entries(tool.args)) {
    const { required: isReq, ...rest } = def;
    properties[key] = rest;
    if (isReq) required.push(key);
  }
  return { type: "object", properties, required };
}

/** MCP tool descriptor for tools/list. */
export function toMcpTool(tool) {
  return { name: tool.name, description: tool.description, inputSchema: toInputSchema(tool) };
}

/**
 * Validate call args against the tool's required fields and array types.
 * Returns { ok, errors }.
 */
export function validateArgs(tool, args = {}) {
  const errors = [];
  for (const [key, def] of Object.entries(tool.args)) {
    const v = args[key];
    if (def.required && (v == null || (Array.isArray(v) && v.length === 0) || v === "")) {
      errors.push(`Missing required argument: ${key}`);
      continue;
    }
    if (v != null && def.type === "array" && !Array.isArray(v)) {
      errors.push(`Argument ${key} must be an array.`);
    }
    if (v != null && def.type === "integer" && typeof v !== "number") {
      errors.push(`Argument ${key} must be a number.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Build the actor input for a validated tool call, dropping undefined keys. */
export function buildActorInput(tool, args) {
  const input = tool.build(args);
  for (const k of Object.keys(input)) if (input[k] === undefined) delete input[k];
  return input;
}
