# User Manual — Apify Portfolio Maintenance Watchdog

## What it does
Audits Actors accessible to the current Apify account for maintenance notices and deprecations.
Optional smoke checks launch selected Actors with tiny inputs and verify their output.

## Quick start (Console)
1. Open the Actor → **Start**. The example audits all public Actors and reports problems without
   failing the first run.
2. Read the metadata rows and **SUMMARY**. Turn on smoke checks only for selected critical Actors.
3. For a daily Schedule, enable **failOnUnhealthy** and the schedule's failure notification.

## Input fields
| Field | What it does |
|---|---|
| **auditPortfolio** | Audit maintenance notices and deprecations without launching checked Actors. |
| **actorIds** | Optional Actor IDs or `user/name` references; empty discovers the account portfolio. |
| **includePrivate** | Include private Actors in automatic discovery. |
| **runSmokeChecks** | Launch configured smoke checks; off by default. |
| **checks** | `[{actorId,input,expectMinItems,timeoutSecs}]`; empty = default fleet. |
| **concurrency** | Concurrent smoke runs (1–4). |
| **memoryMbytes** | Memory per checked run. |
| **failOnUnhealthy** | Fail this run on any problem (fires schedule alerts). |

## Output
Metadata rows contain `checkType`, `actorId`, `actorName`, `status`, `reason`, `notice`, and
`isPublic`. Smoke rows also contain `runStatus`, `items`, and `durationMs`. **SUMMARY** contains
counts, `allHealthy`, and actionable `problems`.

## API
```bash
curl -X POST "https://api.apify.com/v2/acts/alaudinburki~portfolio-health-monitor/runs?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```
## MCP
See [../../docs/MCP.md](../../docs/MCP.md). (Typically run on a Schedule rather than via MCP.)

## Troubleshooting
| Symptom | Meaning |
|---|---|
| `degraded` | An Actor is deprecated, or a smoke run was slow/returned too few rows. |
| `failing` | Apify reports `UNDER_MAINTENANCE`, or an active smoke run failed. |
| Run FAILs | The fleet is unhealthy (by design, so alerts fire). |

The watchdog deliberately does not clear maintenance notices. Clearing without resolving the cause
only hides the signal until Apify reapplies it.
