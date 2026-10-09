// Reliability Toolkit — an MCP server (Apify Standby actor).
//
// Exposes our deployed actors as MCP tools over streamable HTTP, so Claude,
// Cursor, and agents can run them by name. Each tool call runs the underlying
// actor via Actor.call and returns its dataset. Stateless transport: a fresh
// server+transport per request (simple, robust, no session storage).

import http from "node:http";
import { Actor, log } from "apify";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, getTool, toMcpTool, validateArgs, buildActorInput } from "./lib/tools.js";

await Actor.init();

const SERVER_INFO = { name: "reliability-toolkit", version: "0.1.0" };
const MAX_RETURN_ITEMS = 50; // keep tool responses bounded

/** Run one tool: validate → run the actor → return its dataset as text. */
async function runTool(name, args) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const { ok, errors } = validateArgs(tool, args);
  if (!ok) throw new Error(errors.join("; "));

  const input = buildActorInput(tool, args);
  const run = await Actor.call(tool.actorId, input);
  if (!run || run.status !== "SUCCEEDED") {
    throw new Error(`Actor ${tool.actorId} run ${run?.status ?? "did not start"} (run id ${run?.id ?? "?"}).`);
  }

  const dataset = await Actor.openDataset(run.defaultDatasetId);
  const { items, total } = await dataset.getData({ limit: MAX_RETURN_ITEMS });
  return {
    actorId: tool.actorId,
    runId: run.id,
    returned: items.length,
    totalInDataset: total,
    truncated: total > items.length,
    items,
  };
}

/** A fresh MCP server with our two handlers. */
function buildMcpServer() {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(toMcpTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const result = await runTool(name, args ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      // Report tool errors to the model as content with isError, not a transport error.
      return { content: [{ type: "text", text: `Error running ${name}: ${err.message}` }], isError: true };
    }
  });

  return server;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : undefined); } catch { resolve(undefined); } });
    req.on("error", () => resolve(undefined));
  });
}

const port = Actor.config.get("containerPort");

const httpServer = http.createServer(async (req, res) => {
  // Readiness probe — respond instantly so the platform doesn't burn resources.
  if (req.headers["x-apify-container-server-readiness-probe"]) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  // Simple info/health page for humans hitting the URL in a browser.
  if (req.method === "GET" && !String(req.headers.accept ?? "").includes("text/event-stream")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      server: SERVER_INFO,
      description: "MCP server exposing the Reliability Toolkit actors. Connect an MCP client via POST to this URL.",
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    }, null, 2));
    return;
  }

  // MCP over streamable HTTP, stateless: new server+transport per request.
  try {
    const body = await readBody(req);
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close?.(); server.close?.(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    log.exception(err, "MCP request failed");
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: err.message }, id: null }));
    }
  }
});

httpServer.listen(port, () => {
  log.info(`Reliability Toolkit MCP server listening on port ${port} with ${TOOLS.length} tools.`);
});

// Standby actor: keep running; do not Actor.exit().
