import type { TemplateDescriptor, TemplateFile } from "../types.js";
import { envExample, gitignore, packageJson, readme, TS_TSCONFIG, authMiddleware } from "./common.js";

const restIndex = (auth: boolean) => `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";

${auth ? authMiddleware({ auth: true, name: "", template: "rest", transport: "stdio", language: "typescript" } as any) : ""}

interface OpenApiSpec {
  servers?: Array<{ url: string }>;
  paths: Record<string, Record<string, { operationId?: string; summary?: string; parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string } }>; requestBody?: { content?: { "application/json"?: { schema?: { type: string; properties?: Record<string, unknown> } } } } }>>;
}

const specPath = process.env.OPENAPI_SPEC_PATH ?? "openapi.json";
const spec = JSON.parse(await readFile(specPath, "utf8")) as OpenApiSpec;
const baseUrl = spec.servers?.[0]?.url ?? process.env.API_BASE_URL ?? "";

interface ToolEntry { method: string; path: string; spec: NonNullable<OpenApiSpec["paths"]>[string][string]; }
const toolMap = new Map<string, ToolEntry>();

const TOOLS: Tool[] = [];
for (const [route, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (!["get", "post"].includes(method)) continue;
    const name = op.operationId ?? (method + "_" + route).replace(/[^a-zA-Z0-9_]/g, "_");
    const props: Record<string, unknown> = {};
    const required: string[] = [];
    for (const p of op.parameters ?? []) {
      props[p.name] = { type: p.schema?.type ?? "string" };
      if (p.required) required.push(p.name);
    }
    const bodySchema = op.requestBody?.content?.["application/json"]?.schema;
    if (bodySchema?.properties) {
      for (const [k, v] of Object.entries(bodySchema.properties)) {
        props[k] = v;
      }
    }
    TOOLS.push({
      name,
      description: op.summary ?? (method.toUpperCase() + " " + route),
      inputSchema: { type: "object", properties: props, required },
    });
    toolMap.set(name, { method, path: route, spec: op });
  }
}

const server = new Server({ name: "rest-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request${auth ? ", extra" : ""}) => {
  ${auth ? "requireAuth(extra as any);" : ""}
  const entry = toolMap.get(request.params.name);
  if (!entry) return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
  const args = z.record(z.unknown()).parse(request.params.arguments ?? {});

  let url = baseUrl + entry.path;
  for (const p of entry.spec.parameters ?? []) {
    if (p.in === "path") url = url.replace("{" + p.name + "}", encodeURIComponent(String(args[p.name] ?? "")));
  }
  const query: string[] = [];
  for (const p of entry.spec.parameters ?? []) {
    if (p.in === "query" && args[p.name] !== undefined) {
      query.push(encodeURIComponent(p.name) + "=" + encodeURIComponent(String(args[p.name])));
    }
  }
  if (query.length) url += "?" + query.join("&");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.API_BEARER_TOKEN) headers.authorization = "Bearer " + process.env.API_BEARER_TOKEN;
  if (process.env.API_KEY_HEADER && process.env.API_KEY) headers[process.env.API_KEY_HEADER] = process.env.API_KEY;

  const init: RequestInit = { method: entry.method.toUpperCase(), headers };
  if (entry.method !== "get") {
    const bodyKeys = Object.keys(entry.spec.requestBody?.content?.["application/json"]?.schema?.properties ?? {});
    const body: Record<string, unknown> = {};
    for (const k of bodyKeys) if (args[k] !== undefined) body[k] = args[k];
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  return { content: [{ type: "text", text }], isError: !res.ok };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("rest-mcp: ready (" + TOOLS.length + " tools)");
`.trim() + "\n";

export const restTemplate: TemplateDescriptor = {
  name: "rest",
  description: "Wraps any OpenAPI 3.0 REST API as MCP tools.",
  envVars: [
    { name: "OPENAPI_SPEC_PATH", description: "Path to an OpenAPI 3.0 JSON file" },
    { name: "API_BASE_URL", description: "Override servers[0].url from the spec" },
    { name: "API_BEARER_TOKEN", description: "Optional Bearer token" },
    { name: "API_KEY_HEADER", description: "Optional API-key header name" },
    { name: "API_KEY", description: "Optional API-key value" },
  ],
  files(opts) {
    const files: TemplateFile[] = [packageJson(opts), gitignore(), envExample(this.envVars)];
    if (opts.language === "typescript") {
      files.push(TS_TSCONFIG);
      files.push({ path: "src/index.ts", contents: restIndex(opts.auth) });
    } else {
      files.push({
        path: "src/index.js",
        contents: restIndex(opts.auth).replace(/: \w+(\[\])?/g, "").replace(/import type[\s\S]+?from[^;]+;\n/g, ""),
      });
    }
    files.push({
      path: "openapi.json",
      contents: JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Example", version: "1.0.0" },
        servers: [{ url: "https://api.example.com" }],
        paths: {
          "/ping": { get: { operationId: "ping", summary: "Health check" } },
        },
      }, null, 2) + "\n",
    });
    files.push(readme(opts, "## Tools\n\nAuto-generated from `openapi.json`. Replace the spec to expose your own API."));
    return files;
  },
};
