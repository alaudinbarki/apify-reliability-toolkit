# Reliability Toolkit — MCP Server

Connect one MCP server to nine maintained Apify data tools: Amazon products, email verification,
job changes, Google Trends, AI visibility, contact discovery, Product Hunt and prediction markets.
Each MCP tool call runs the underlying Actor and returns up to 50 structured result rows.

## Connect

This is a **Standby MCP server**, not a batch Actor. Use the stable Standby URL shown in the
Actor's **Endpoints** tab, with an Apify token in the authorization header:

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

Add this to a Streamable-HTTP-compatible MCP client such as Claude or Cursor. Apify starts and
scales Standby runs as requests arrive; do not use the ordinary batch **Start** form.

## Available tools

`amazon_products`, `verify_emails`, `monitor_jobs`, `google_trends_daily`,
`google_trends_full`, `ai_brand_visibility`, `find_contacts`, `product_hunt`, and
`prediction_markets`.

Some tools require a customer-owned provider key: AI visibility needs an LLM key and Product Hunt
needs its developer token. Each tool validates required arguments before starting its underlying
Actor and returns a readable MCP error when input is invalid.

## Cost and limits

The Toolkit charges **$0.02 per tool call**. Underlying Actors have their own normal Apify charges.
Responses are limited to 50 dataset rows; call an Actor directly for larger exports.

## Reliability boundary

The server is tested for MCP tool discovery, validation and input conversion. A live client must
make the final connection test because Standby authentication uses that client's Apify token.
