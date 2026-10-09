# Apify Portfolio Maintenance Watchdog

Audits every Actor in an Apify account for maintenance notices and deprecations. Optional active
smoke checks can launch selected critical Actors with tiny inputs. When anything needs attention,
the watchdog fails its own scheduled run so Apify's failure notification and connected webhooks fire.

Built reliability-first: **every row reports what was found and what was missing** — you never get a
silent blank, and a run summary tells you exactly what happened.

## What you get
| Field | Description |
|---|---|
| `checkType` | `metadata` or `smoke` |
| `actorId` | Actor Id |
| `actorName` | Actor name from the live API |
| `status` | Status |
| `reason` | Reason |
| `notice` | Live Apify notice, including `UNDER_MAINTENANCE` |
| `isPublic` | Whether the Actor is public |
| `runStatus` | Run Status |
| `items` | Items |
| `expectedMinItems` | Expected Min Items |
| `durationMs` | Duration Ms |

## How to use it
1. Fill in the input (see the example below).
2. Run it once for a snapshot, or **schedule it** to keep the data fresh.
3. Export to CSV/JSON/Excel, or push straight to Google Sheets, Notion, Airtable, Zapier, Make, or n8n.

## Input
```json
{
  "auditPortfolio": true,
  "actorIds": [],
  "includePrivate": false,
  "runSmokeChecks": false,
  "concurrency": 2,
  "failOnUnhealthy": true
}
```

## Sample output
```json
[
{
  "checkType": "metadata",
  "actorId": "username/example-actor",
  "actorName": "example-actor",
  "status": "failing",
  "reason": "Apify marked this Actor under maintenance",
  "notice": "UNDER_MAINTENANCE",
  "isPublic": true
}
]
```

## Typical uses
- Run a cheap daily portfolio audit without launching every Actor.
- Add active smoke checks only for business-critical Actors with safe example inputs.
- Connect failed-run notifications or webhooks to email, Slack, Make, Zapier, or n8n.
- Keep evidence of when a maintenance flag appeared instead of repeatedly clearing it blindly.

## Pricing
**`$0.001` per actor checked**, plus a near-zero start fee. You are **never charged beyond your limit**, and blocked or
failed items are reported honestly — not billed as data.

## FAQ & limitations
- It audits Actors accessible to the Apify account running it; it cannot inspect another account's
  private Actors.
- It reports maintenance notices but deliberately does not clear them automatically.
- Active smoke checks can incur the checked Actors' normal compute and event charges.
- Credential-gated Actors need caller-supplied safe test credentials or metadata-only monitoring.
- **Integrations:** output works with Zapier, Make, n8n, and any webhook via Apify's integrations.
- **Formats:** results export as JSON, CSV, Excel, or HTML from the dataset.

## Related actors
- **Portfolio Health Monitor**
- **Format Converter**
- **URL Metadata Extractor**
