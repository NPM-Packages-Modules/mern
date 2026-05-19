import type { TemplateDescriptor, TemplateFile } from "../types.js";
import { envExample, gitignore, packageJson, readme, TS_TSCONFIG, authMiddleware } from "./common.js";

const postgresIndex = (auth: boolean) => `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

${auth ? authMiddleware({ auth: true, name: "", template: "postgres", transport: "stdio", language: "typescript" } as any) : ""}

const server = new Server(
  { name: "postgres-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  {
    name: "query",
    description: "Run a read-only SQL query with bound parameters",
    inputSchema: {
      type: "object",
      properties: { sql: { type: "string" }, params: { type: "array", items: {} } },
      required: ["sql"],
    },
  },
  {
    name: "list_tables",
    description: "List all tables in the public schema",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "describe_table",
    description: "Describe columns and types of a given table",
    inputSchema: {
      type: "object",
      properties: { table: { type: "string" } },
      required: ["table"],
    },
  },
  {
    name: "insert",
    description: "Insert a row into the named table",
    inputSchema: {
      type: "object",
      properties: { table: { type: "string" }, row: { type: "object" } },
      required: ["table", "row"],
    },
  },
  {
    name: "update",
    description: "Update rows in the named table matching a where clause (parameterised)",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        set: { type: "object" },
        where: { type: "object" },
      },
      required: ["table", "set", "where"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request${auth ? ", extra" : ""}) => {
  ${auth ? "requireAuth(extra as any);" : ""}
  try {
    if (request.params.name === "query") {
      const args = z.object({ sql: z.string(), params: z.array(z.unknown()).optional() }).parse(request.params.arguments);
      const res = await pool.query(args.sql, args.params as unknown[] | undefined);
      return { content: [{ type: "text", text: JSON.stringify({ rowCount: res.rowCount, rows: res.rows }, null, 2) }] };
    }
    if (request.params.name === "list_tables") {
      const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
      return { content: [{ type: "text", text: JSON.stringify(res.rows, null, 2) }] };
    }
    if (request.params.name === "describe_table") {
      const args = z.object({ table: z.string() }).parse(request.params.arguments);
      const res = await pool.query(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
        [args.table],
      );
      return { content: [{ type: "text", text: JSON.stringify(res.rows, null, 2) }] };
    }
    if (request.params.name === "insert") {
      const args = z.object({ table: z.string(), row: z.record(z.unknown()) }).parse(request.params.arguments);
      const cols = Object.keys(args.row);
      const placeholders = cols.map((_, i) => "$" + (i + 1)).join(", ");
      const sql = "INSERT INTO " + JSON.stringify(args.table).slice(1, -1) + " (" + cols.map((c) => '"' + c + '"').join(", ") + ") VALUES (" + placeholders + ") RETURNING *";
      const res = await pool.query(sql, cols.map((c) => args.row[c]));
      return { content: [{ type: "text", text: JSON.stringify(res.rows[0], null, 2) }] };
    }
    if (request.params.name === "update") {
      const args = z.object({ table: z.string(), set: z.record(z.unknown()), where: z.record(z.unknown()) }).parse(request.params.arguments);
      const setKeys = Object.keys(args.set);
      const whereKeys = Object.keys(args.where);
      const setSql = setKeys.map((k, i) => '"' + k + '" = $' + (i + 1)).join(", ");
      const whereSql = whereKeys.map((k, i) => '"' + k + '" = $' + (i + 1 + setKeys.length)).join(" AND ");
      const sql = "UPDATE " + JSON.stringify(args.table).slice(1, -1) + " SET " + setSql + " WHERE " + whereSql + " RETURNING *";
      const params = [...setKeys.map((k) => args.set[k]), ...whereKeys.map((k) => args.where[k])];
      const res = await pool.query(sql, params);
      return { content: [{ type: "text", text: JSON.stringify({ updated: res.rowCount, rows: res.rows }, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: String(err) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("postgres-mcp: connected");
`.trim() + "\n";

export const postgresTemplate: TemplateDescriptor = {
  name: "postgres",
  description: "MCP server backed by Postgres with query, list_tables, describe_table, insert, update tools.",
  envVars: [
    { name: "DATABASE_URL", description: "Postgres connection string e.g. postgres://user:pass@host:5432/db" },
  ],
  files(opts) {
    const files: TemplateFile[] = [
      packageJson(opts, { pg: "^8.11.3" }),
      gitignore(),
      envExample(this.envVars),
    ];
    if (opts.language === "typescript") {
      files.push(TS_TSCONFIG);
      files.push({ path: "src/index.ts", contents: postgresIndex(opts.auth) });
    } else {
      files.push({
        path: "src/index.js",
        contents: postgresIndex(opts.auth).replace(/: \w+(\[\])?/g, "").replace(/import type[\s\S]+?from[^;]+;\n/g, ""),
      });
    }
    files.push(
      readme(opts, `
## Tools

- \`query\` — run an arbitrary SQL query with bound parameters
- \`list_tables\` — list public-schema tables
- \`describe_table\` — describe columns of a table
- \`insert\` — insert a row into a table
- \`update\` — update rows matching a where clause
`),
    );
    return files;
  },
};
