# User Manual — Reliability Toolkit MCP Server

## What it does

Runs as an **MCP server** (Apify Standby mode) that exposes 9 of this account's data Actors
as tools to Claude, Cursor, and AI agents. An assistant connected to it can scrape Amazon,
verify emails, find leads, pull Google Trends, list Product Hunt launches, or read
prediction-market odds — by asking in plain language.

## One-time setup by the owner

This is a Standby actor. To make it serve requests:

1. Console → this Actor → **Standby** tab → **enable Standby mode**.
2. Copy the **Standby URL** shown there.
3. (Publish the Actor if others should use it.)

## How a user connects an MCP client

Add an MCP server pointing at the Standby URL, authenticated with an Apify token:

```json
{
  "mcpServers": {
    "reliability-toolkit": {
      "url": "https://<your-standby-url>",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

- **Claude Desktop / Claude.ai:** Settings → Connectors → add custom connector with that URL.
- **Cursor / VS Code:** put the JSON above in the MCP config file.

Then ask, e.g. *"Verify these emails and tell me which bounce"* or *"What's trending in the
US today?"* — the assistant discovers the tools and runs them.

## Tools

`amazon_products`, `verify_emails`, `monitor_jobs`, `google_trends_daily`,
`google_trends_full`, `ai_brand_visibility` (needs an LLM key arg), `find_contacts`,
`product_hunt` (needs a PH token arg), `prediction_markets`.

## How it works

Each tool call runs the underlying Actor via `Actor.call` and returns its dataset (first 50
items, with `truncated`/`totalInDataset` flags). Runs are billed like any Actor run — the
MCP server's run plus the sub-Actor's run.

## Notes & limitations

- **Enable Standby first**, or the URL won't serve.
- Tool calls take as long as the underlying scrape (seconds to a couple of minutes).
- Cookie-gated Actors (Amazon reviews, eBay sold) are intentionally **not** exposed here, to
  keep the toolkit clean — use those directly with a cookie.
- Results cap at 50 items/call; run an Actor directly for full datasets.

## Verified

The MCP protocol (`initialize` + `tools/list`) was verified end-to-end locally — all 9 tools
enumerate correctly. Live serving requires Standby enabled in Console.
