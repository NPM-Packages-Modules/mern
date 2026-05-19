#!/usr/bin/env node
import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { scaffold, TEMPLATES } from "./scaffold.js";
import type { ScaffoldOptions } from "./types.js";

const program = new Command();
program
  .name("create-mcp-server")
  .description("Scaffold a Model Context Protocol (MCP) server")
  .argument("[name]", "Project directory name")
  .option("--template <name>", "blank | postgres | stripe | rest | filesystem")
  .option("--transport <transport>", "stdio | sse", "stdio")
  .option("--language <lang>", "typescript | javascript", "typescript")
  .option("--auth", "Include an API key auth middleware", false)
  .option("-y, --yes", "Skip prompts, use defaults", false)
  .action(async (nameArg: string | undefined, opts: { template?: string; transport: string; language: string; auth: boolean; yes: boolean }) => {
    const answers = opts.yes
      ? { name: nameArg ?? "my-mcp-server", template: opts.template ?? "blank" }
      : await prompts(
          [
            { type: nameArg ? null : "text", name: "name", message: "Project name", initial: "my-mcp-server" },
            {
              type: opts.template ? null : "select",
              name: "template",
              message: "Template",
              choices: Object.values(TEMPLATES).map((t) => ({ title: `${t.name} — ${t.description}`, value: t.name })),
            },
          ],
          { onCancel: () => process.exit(1) },
        );

    const finalOpts: ScaffoldOptions = {
      name: nameArg ?? answers.name ?? "my-mcp-server",
      template: (opts.template ?? answers.template ?? "blank") as ScaffoldOptions["template"],
      transport: opts.transport as ScaffoldOptions["transport"],
      language: opts.language as ScaffoldOptions["language"],
      auth: opts.auth,
    };

    try {
      const target = scaffold(finalOpts);
      process.stdout.write(pc.green(`✓ Created ${finalOpts.name} (${finalOpts.template}/${finalOpts.transport}/${finalOpts.language})\n`));
      process.stdout.write(`\nNext:\n  cd ${finalOpts.name}\n  cp .env.example .env\n  npm install\n${finalOpts.language === "typescript" ? "  npm run build\n" : ""}  npm start\n`);
      process.stdout.write(`\nTarget: ${target}\n`);
    } catch (err) {
      process.stderr.write(pc.red(`create-mcp-server: ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
