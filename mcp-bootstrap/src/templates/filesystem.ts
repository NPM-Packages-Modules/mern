import type { TemplateDescriptor, TemplateFile } from "../types.js";
import { envExample, gitignore, packageJson, readme, TS_TSCONFIG, authMiddleware } from "./common.js";

const fsIndex = (auth: boolean) => `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(process.env.SANDBOX_ROOT ?? process.cwd());

function safePath(p: string): string {
  const abs = resolve(ROOT, p);
  if (!abs.startsWith(ROOT + sep) && abs !== ROOT) throw new Error("Path escapes sandbox");
  return abs;
}

${auth ? authMiddleware({ auth: true, name: "", template: "filesystem", transport: "stdio", language: "typescript" } as any) : ""}

const server = new Server({ name: "filesystem-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

const TOOLS: Tool[] = [
  { name: "read_file", description: "Read a UTF-8 file", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Write a UTF-8 file", inputSchema: { type: "object", properties: { path: { type: "string" }, contents: { type: "string" } }, required: ["path", "contents"] } },
  { name: "list_directory", description: "List a directory", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "search_files", description: "Recursively grep files for a substring", inputSchema: { type: "object", properties: { needle: { type: "string" }, path: { type: "string" } }, required: ["needle"] } },
  { name: "get_file_info", description: "stat a file or directory", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request${auth ? ", extra" : ""}) => {
  ${auth ? "requireAuth(extra as any);" : ""}
  try {
    if (request.params.name === "read_file") {
      const args = z.object({ path: z.string() }).parse(request.params.arguments);
      const content = await readFile(safePath(args.path), "utf8");
      return { content: [{ type: "text", text: content }] };
    }
    if (request.params.name === "write_file") {
      const args = z.object({ path: z.string(), contents: z.string() }).parse(request.params.arguments);
      await writeFile(safePath(args.path), args.contents, "utf8");
      return { content: [{ type: "text", text: "OK" }] };
    }
    if (request.params.name === "list_directory") {
      const args = z.object({ path: z.string() }).parse(request.params.arguments);
      const entries = await readdir(safePath(args.path), { withFileTypes: true });
      return { content: [{ type: "text", text: JSON.stringify(entries.map((e) => ({ name: e.name, dir: e.isDirectory() })), null, 2) }] };
    }
    if (request.params.name === "search_files") {
      const args = z.object({ needle: z.string(), path: z.string().default(".") }).parse(request.params.arguments);
      const hits = await search(safePath(args.path), args.needle);
      return { content: [{ type: "text", text: JSON.stringify(hits, null, 2) }] };
    }
    if (request.params.name === "get_file_info") {
      const args = z.object({ path: z.string() }).parse(request.params.arguments);
      const s = await stat(safePath(args.path));
      return { content: [{ type: "text", text: JSON.stringify({ size: s.size, isDir: s.isDirectory(), mtime: s.mtime }, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: String(err) }], isError: true };
  }
});

async function search(root: string, needle: string): Promise<{ file: string; line: number; text: string }[]> {
  const out: { file: string; line: number; text: string }[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) {
        try {
          const txt = await readFile(p, "utf8");
          const lines = txt.split(/\\r?\\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            if (line.includes(needle)) out.push({ file: p, line: i + 1, text: line });
          }
        } catch {
          // skip binary or unreadable files
        }
      }
    }
  }
  await walk(root);
  return out;
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("filesystem-mcp: ready under " + ROOT);
`.trim() + "\n";

export const filesystemTemplate: TemplateDescriptor = {
  name: "filesystem",
  description: "Sandboxed filesystem tools (read, write, list, search, stat).",
  envVars: [{ name: "SANDBOX_ROOT", description: "Absolute path the server is allowed to read/write" }],
  files(opts) {
    const files: TemplateFile[] = [packageJson(opts), gitignore(), envExample(this.envVars)];
    if (opts.language === "typescript") {
      files.push(TS_TSCONFIG);
      files.push({ path: "src/index.ts", contents: fsIndex(opts.auth) });
    } else {
      files.push({
        path: "src/index.js",
        contents: fsIndex(opts.auth).replace(/: \w+(\[\])?/g, "").replace(/import type[\s\S]+?from[^;]+;\n/g, ""),
      });
    }
    files.push(readme(opts, "## Tools\n\n- read_file, write_file, list_directory, search_files, get_file_info"));
    return files;
  },
};
