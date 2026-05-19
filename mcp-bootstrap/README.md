# mcp-bootstrap

[![npm version](https://img.shields.io/npm/v/mcp-bootstrap.svg)](https://www.npmjs.com/package/mcp-bootstrap)
[![license](https://img.shields.io/npm/l/mcp-bootstrap.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**MCP is the new standard for AI tool use.** Claude, ChatGPT, Cursor, and Windsurf all support it. Most developers don't know how to ship an MCP server. This scaffolder fixes that in 30 seconds:

```bash
npx mcp-bootstrap my-server
```

Pick a template — **Postgres**, **Stripe**, **REST API wrapper**, **File System**, or **Blank** — and you get a working server with proper `tools/list` / `tools/call` handlers, env config, a ready-to-paste Claude Desktop config snippet, and (optionally) an API-key auth middleware.

---

## Installation

```bash
# Use directly, no global install needed:
npx mcp-bootstrap my-server

# Or install once:
npm install -g mcp-bootstrap
mcp-bootstrap my-server
```

---

## Quick Start

```bash
npx mcp-bootstrap my-pg
# ? Template: postgres
cd my-pg
echo "DATABASE_URL=postgres://localhost/db" > .env
npm install
npm run build
npm start
# postgres-mcp: connected
```

Add to Claude Desktop:

```json
{
  "mcpServers": {
    "my-pg": {
      "command": "node",
      "args": ["/abs/path/to/my-pg/dist/index.js"],
      "env": { "DATABASE_URL": "postgres://localhost/db" }
    }
  }
}
```

---

## Core Usage Examples

### 1. Postgres + Claude Desktop

```bash
npx mcp-bootstrap pg-mcp --template postgres
cd pg-mcp && npm install && npm run build
# Add the snippet above to ~/Library/Application Support/Claude/claude_desktop_config.json
```

### 2. Stripe + MCP inspector

```bash
npx mcp-bootstrap stripe-mcp --template stripe
echo "STRIPE_SECRET_KEY=sk_test_..." > stripe-mcp/.env
cd stripe-mcp && npm install && npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

### 3. Adding a custom tool to the Blank template

```ts
TOOLS.push({
  name: "uppercase",
  description: "Uppercase a string",
  inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "uppercase") {
    const args = z.object({ text: z.string() }).parse(request.params.arguments);
    return { content: [{ type: "text", text: args.text.toUpperCase() }] };
  }
  // ... fall through to existing handlers
});
```

### 4. Adding a Resource

```ts
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: "config://app", name: "App config", mimeType: "application/json" }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => ({
  contents: [{ uri: req.params.uri, mimeType: "application/json", text: '{"hello":"world"}' }],
}));
```

### 5. SSE transport

```bash
npx mcp-bootstrap my-sse --template blank --transport sse
```

### 6. REST wrapper with OpenAPI

```bash
npx mcp-bootstrap my-rest --template rest
cp my-api.openapi.json my-rest/openapi.json
cd my-rest && npm install && npm run build && npm start
```

---

## Template Reference

### `postgres`

- **Tools**: `query`, `list_tables`, `describe_table`, `insert`, `update`
- **Env**: `DATABASE_URL`
- **Files**: `src/index.ts`, `package.json` (with `pg`), `.env.example`, `tsconfig.json`, `README.md`
- **Claude Desktop snippet**: included in generated README

### `stripe`

- **Tools**: `list_customers`, `get_customer`, `list_invoices`, `create_payment_link`, `get_balance`
- **Env**: `STRIPE_SECRET_KEY`

### `rest`

- **Tools**: auto-generated from your `openapi.json`
- **Env**: `OPENAPI_SPEC_PATH`, `API_BASE_URL`, `API_BEARER_TOKEN`, `API_KEY_HEADER`, `API_KEY`

### `filesystem`

- **Tools**: `read_file`, `write_file`, `list_directory`, `search_files`, `get_file_info`
- **Env**: `SANDBOX_ROOT` (server refuses to read/write outside)

### `blank`

- One `echo` tool. Inline comments explaining each MCP concept.

---

## MCP Concepts Explained

- **Tools** — actions the client (e.g. Claude) can call. Declared via `tools/list`, executed via `tools/call`. Inputs are JSON Schema; outputs are `{ content: [{ type: "text", text }] }`.
- **Resources** — read-only data the client can fetch by URI. Declared via `resources/list`, fetched via `resources/read`.
- **Prompts** — pre-canned prompts the client can offer to the user.
- **stdio transport** — the server is a local subprocess; messages are JSON-RPC over stdin/stdout.
- **SSE transport** — the server is a remote HTTP service; messages stream over Server-Sent Events.

Claude Desktop discovers servers via its config file at `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

---

## Adding Custom Tools

```ts
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const TOOLS: Tool[] = [{
  name: "run_report",
  description: "Run the weekly KPI report",
  inputSchema: {
    type: "object",
    properties: { quarter: { type: "string", pattern: "^Q[1-4]-\\d{4}$" } },
    required: ["quarter"],
  },
}];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "run_report") {
    const args = z.object({ quarter: z.string() }).parse(request.params.arguments);
    const rows = await db.query("SELECT * FROM kpi WHERE quarter = $1", [args.quarter]);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
  return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
});
```

---

## TypeScript Types

```ts
import type { Tool, Resource, CallToolRequest, ListToolsResponse } from "@modelcontextprotocol/sdk/types.js";

const myTool: Tool = {
  name: "do_thing",
  description: "Does the thing",
  inputSchema: { type: "object", properties: { x: { type: "number" } }, required: ["x"] },
};

async function handle(req: CallToolRequest): Promise<{ content: { type: "text"; text: string }[] }> {
  return { content: [{ type: "text", text: "ok" }] };
}
```

---

## CLI Reference

```
mcp-bootstrap [name] [options]

Options:
  --template <name>      blank | postgres | stripe | rest | filesystem
  --transport <t>        stdio | sse  (default: stdio)
  --language <lang>      typescript | javascript  (default: typescript)
  --auth                 Include an x-api-key auth middleware
  -y, --yes              Skip prompts (use defaults / flags only)
```

Non-interactive:

```bash
npx mcp-bootstrap my-pg --template postgres --transport stdio --language typescript --auth --yes
```

---

## Real-World Recipe — Production Postgres MCP Server

```bash
# 1. Scaffold
npx mcp-bootstrap kpi-mcp --template postgres --auth --yes
cd kpi-mcp
```

```ts
// 2. Add a safe custom tool
TOOLS.push({
  name: "run_report",
  description: "Run a parameterized KPI report",
  inputSchema: {
    type: "object",
    properties: { quarter: { type: "string" } },
    required: ["quarter"],
  },
});
```

```bash
# 3. Configure
echo "DATABASE_URL=postgres://app:secret@db.internal:5432/kpi" > .env
echo "MCP_API_KEY=$(openssl rand -hex 32)" >> .env

# 4. Build and start under PM2
npm install && npm run build
pm2 start dist/index.js --name kpi-mcp
```

```json
// 5. Claude Desktop config (remote SSE example)
{
  "mcpServers": {
    "kpi-mcp": {
      "command": "node",
      "args": ["/srv/kpi-mcp/dist/index.js"],
      "env": { "DATABASE_URL": "postgres://...", "MCP_API_KEY": "..." }
    }
  }
}
```

Claude can now ask: _"Run the Q1-2026 KPI report and summarise the trends."_

---

## Connecting to Different AI Clients

### Claude Desktop

```json
{ "mcpServers": { "x": { "command": "node", "args": ["/abs/path/dist/index.js"] } } }
```

### Cursor

`~/.cursor/mcp.json`:

```json
{ "mcpServers": { "x": { "command": "node", "args": ["/abs/path/dist/index.js"] } } }
```

### Windsurf

Same shape under `~/.codeium/windsurf/mcp_config.json`.

### Any MCP-compatible client (SSE)

```json
{ "mcpServers": { "x": { "url": "https://mcp.example.com/sse", "headers": { "x-api-key": "..." } } } }
```

---

## Comparison Table

| Feature               | Manual MCP setup | mcp-framework | **mcp-bootstrap** |
| --------------------- | :--------------: | :-----------: | :-------------------: |
| Templates             |        ❌        |       ⚠️      |          ✅           |
| stdio + SSE           |        DIY       |       ✅      |          ✅           |
| TypeScript            |        DIY       |       ✅      |          ✅           |
| Claude Desktop snippet|        ❌        |       ❌      |          ✅           |
| OpenAPI wrapper       |        ❌        |       ❌      |          ✅           |
| Auth middleware       |        DIY       |       ❌      |          ✅           |
| Tests included        |        ❌        |       ❌      |          ✅           |

---

## License

MIT
