import type { TemplateDescriptor, TemplateFile } from "../types.js";
import { envExample, gitignore, packageJson, readme, TS_TSCONFIG, authMiddleware } from "./common.js";

const blankIndexTs = (auth: boolean) => `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

${auth ? authMiddleware({ auth: true, name: "", template: "blank", transport: "stdio", language: "typescript" } as any) : ""}

const server = new Server(
  { name: "blank-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  {
    name: "echo",
    description: "Returns whatever message you send. The simplest possible tool.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request${auth ? ", extra" : ""}) => {
  ${auth ? "requireAuth(extra as any);" : ""}
  if (request.params.name === "echo") {
    const args = z.object({ message: z.string() }).parse(request.params.arguments);
    return { content: [{ type: "text", text: args.message }] };
  }
  return { content: [{ type: "text", text: "Unknown tool: " + request.params.name }], isError: true };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("blank-mcp-server: ready");
`.trim() + "\n";

export const blankTemplate: TemplateDescriptor = {
  name: "blank",
  description: "Minimal MCP server with one example tool and explanatory comments.",
  envVars: [],
  files(opts) {
    const files: TemplateFile[] = [packageJson(opts), gitignore(), envExample([])];
    if (opts.language === "typescript") {
      files.push(TS_TSCONFIG);
      files.push({ path: "src/index.ts", contents: blankIndexTs(opts.auth) });
    } else {
      files.push({
        path: "src/index.js",
        contents: blankIndexTs(opts.auth).replace(/: \w+(\[\])?/g, "").replace(/import type[\s\S]+?from[^;]+;\n/g, ""),
      });
    }
    files.push(
      readme(opts, `
## Tools

- \`echo\` — echoes back the supplied \`message\`.

## Adding more tools

1. Append to the \`TOOLS\` array with a JSON Schema for inputs.
2. Add a branch to the \`CallToolRequestSchema\` handler returning \`{ content: [...] }\`.
`),
    );
    return files;
  },
};
