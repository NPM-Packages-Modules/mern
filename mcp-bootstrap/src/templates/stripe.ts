import type { TemplateDescriptor, TemplateFile } from "../types.js";
import { envExample, gitignore, packageJson, readme, TS_TSCONFIG, authMiddleware } from "./common.js";

const stripeIndex = (auth: boolean) => `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import Stripe from "stripe";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

${auth ? authMiddleware({ auth: true, name: "", template: "stripe", transport: "stdio", language: "typescript" } as any) : ""}

const server = new Server({ name: "stripe-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

const TOOLS: Tool[] = [
  { name: "list_customers", description: "List Stripe customers", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "get_customer", description: "Get a customer by id", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_invoices", description: "List recent invoices", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  {
    name: "create_payment_link",
    description: "Create a Stripe payment link for a price",
    inputSchema: { type: "object", properties: { price: { type: "string" }, quantity: { type: "number" } }, required: ["price"] },
  },
  { name: "get_balance", description: "Get the current Stripe balance", inputSchema: { type: "object", properties: {} } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request${auth ? ", extra" : ""}) => {
  ${auth ? "requireAuth(extra as any);" : ""}
  try {
    if (request.params.name === "list_customers") {
      const args = z.object({ limit: z.number().optional() }).parse(request.params.arguments ?? {});
      const res = await stripe.customers.list({ limit: args.limit ?? 10 });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
    if (request.params.name === "get_customer") {
      const args = z.object({ id: z.string() }).parse(request.params.arguments);
      const c = await stripe.customers.retrieve(args.id);
      return { content: [{ type: "text", text: JSON.stringify(c, null, 2) }] };
    }
    if (request.params.name === "list_invoices") {
      const args = z.object({ limit: z.number().optional() }).parse(request.params.arguments ?? {});
      const res = await stripe.invoices.list({ limit: args.limit ?? 10 });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
    if (request.params.name === "create_payment_link") {
      const args = z.object({ price: z.string(), quantity: z.number().default(1) }).parse(request.params.arguments);
      const link = await stripe.paymentLinks.create({ line_items: [{ price: args.price, quantity: args.quantity }] });
      return { content: [{ type: "text", text: JSON.stringify(link, null, 2) }] };
    }
    if (request.params.name === "get_balance") {
      const b = await stripe.balance.retrieve();
      return { content: [{ type: "text", text: JSON.stringify(b, null, 2) }] };
    }
    return { content: [{ type: "text", text: "Unknown tool" }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: String(err) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("stripe-mcp: connected");
`.trim() + "\n";

export const stripeTemplate: TemplateDescriptor = {
  name: "stripe",
  description: "Stripe customer / invoice / payment link tools via the official Stripe SDK.",
  envVars: [{ name: "STRIPE_SECRET_KEY", description: "Stripe secret key (sk_test_... or sk_live_...)" }],
  files(opts) {
    const files: TemplateFile[] = [
      packageJson(opts, { stripe: "^14.20.0" }),
      gitignore(),
      envExample(this.envVars),
    ];
    if (opts.language === "typescript") {
      files.push(TS_TSCONFIG);
      files.push({ path: "src/index.ts", contents: stripeIndex(opts.auth) });
    } else {
      files.push({
        path: "src/index.js",
        contents: stripeIndex(opts.auth).replace(/: \w+(\[\])?/g, "").replace(/import type[\s\S]+?from[^;]+;\n/g, ""),
      });
    }
    files.push(
      readme(opts, `
## Tools

- \`list_customers\`, \`get_customer\` — customer reads
- \`list_invoices\` — invoice reads
- \`create_payment_link\` — create a Stripe payment link
- \`get_balance\` — current balance
`),
    );
    return files;
  },
};
