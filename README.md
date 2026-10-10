# Apify Reliability Toolkit

Two small [Apify Actors](https://apify.com) that do the unglamorous work of keeping an actor fleet
alive: exposing your data tools to AI agents, and noticing when something breaks before your users do.

Both are self-contained, dependency-light, and run on Apify's free tier.

| Actor | What it does |
| --- | --- |
| [`reliability-toolkit-mcp`](actors/reliability-toolkit-mcp/) | **MCP server** exposing nine maintained Apify data tools to Claude, Cursor, and any MCP client |
| [`portfolio-health-monitor`](actors/portfolio-health-monitor/) | Audits an actor portfolio for deprecations and `UNDER_MAINTENANCE` notices, and fails loudly |

---

## 1. `reliability-toolkit-mcp` — nine data tools over MCP

Agents can call Apify Actors today, but wiring nine of them up one at a time is tedious and fragile.
This is a single **Standby MCP server** that fronts all nine.

Available tools: `amazon_products`, `verify_emails`, `monitor_jobs`, `google_trends_daily`,
`google_trends_full`, `ai_brand_visibility`, `find_contacts`, `product_hunt`, `prediction_markets`.

Each tool call runs the underlying Actor and returns up to 50 structured rows.

### Connect

This is a **Standby** Actor, not a batch Actor. Use the stable Standby URL from the Actor's
**Endpoints** tab:

```json
{
  "mcpServers": {
    "reliability-toolkit": {
      "url": "https://<standby-url>/",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

Works with any Streamable-HTTP MCP client (Claude, Cursor). Apify starts and scales Standby runs as
requests arrive — use the Standby URL, **not** the batch *Start* form.

### Run it locally

```bash
cd actors/reliability-toolkit-mcp
npm install
npm test        # 23 contract tests
npm run start   # or: apify run
```

---

## 2. `portfolio-health-monitor` — catch breakage before your users do

Apify marks Actors `UNDER_MAINTENANCE` or deprecates them without much ceremony. This Actor audits an
entire portfolio and **fails its own scheduled run** when anything needs attention — so Apify's failure
notifications and your webhooks fire instead of you discovering an outage from a customer.

Optional smoke checks can launch selected critical Actors with tiny inputs to confirm they still
return data.

| Field | Description |
| --- | --- |
| `checkType` | `metadata` or `smoke` |
| `actorId` / `actorName` | The Actor audited |
| `status` | Audit status |
| `notice` | Live Apify notice, including `UNDER_MAINTENANCE` |
| `isPublic` | Whether the Actor is public |
| `runStatus` / `items` / `expectedMinItems` | Result of an optional smoke check |
| `durationMs` | How long the check took |

### Input

```json
{
  "auditPortfolio": true,
  "includePrivate": false,
  "runSmokeChecks": false,
  "failOnUnhealthy": true
}
```

Run it once for a snapshot, or **schedule** it. Export to CSV/JSON, or push to Google Sheets, Notion,
Airtable, Zapier, Make, or n8n.

```bash
cd actors/portfolio-health-monitor
npm install
npm test        # 23 contract tests
```

---

## Design principles

Both Actors follow the same rules, which is most of why they are dependable:

- **Every row reports what was found *and* what was missing.** You never get a silent blank row; a run
  summary states exactly what happened.
- **Credentials are never logged or embedded.** Tokens are read from input or the environment and kept
  out of error messages and audit metadata.
- **Contract tests, not vibes.** Each Actor has tests asserting endpoint, model, secret handling, and
  output shape. A fake-provider pass proves the contract — never model quality.

## Status

Both Actors are deployed and tested, and both are **live on the Apify Store**:

- [`alaudinburki/reliability-toolkit-mcp`](https://apify.com/alaudinburki/reliability-toolkit-mcp)
- [`alaudinburki/portfolio-health-monitor`](https://apify.com/alaudinburki/portfolio-health-monitor)

Everything here is MIT licensed, so you are free to self-host, fork, or deploy your own copy.

## License

MIT — see [LICENSE](LICENSE). Each Actor keeps its own README with fuller detail.