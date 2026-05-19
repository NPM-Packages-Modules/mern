#!/usr/bin/env node
import { Command } from "commander";
import { FileStorage } from "./storage.js";
import { PromptForge } from "./forge.js";

async function makeForge(dir?: string) {
  return new PromptForge({ storage: new FileStorage({ ...(dir ? { dir } : {}) }) });
}

const program = new Command();
program
  .name("prompt-forge")
  .description("Versioned, rollback-able LLM prompt management")
  .option("-d, --dir <path>", "Prompt directory", "prompts");

program
  .command("init")
  .description("Create the prompts directory and registry")
  .action(async () => {
    const forge = await makeForge(program.opts().dir);
    await forge.init();
    process.stdout.write(`prompt-forge: initialised ${program.opts().dir}\n`);
  });

program
  .command("create <name>")
  .description("Create a new prompt version")
  .option("-t, --template <text>", "Template text", "Hello {{name}}!")
  .option("-m, --model <model>", "Default model")
  .action(async (name: string, opts: { template: string; model?: string }) => {
    const forge = await makeForge(program.opts().dir);
    const extras: { model?: string } = {};
    if (opts.model) extras.model = opts.model;
    const prompt = await forge.create(name, opts.template, extras);
    process.stdout.write(
      `prompt-forge: created ${prompt.id} v${prompt.version}\n`,
    );
  });

program
  .command("rollback <name> <version>")
  .description("Set a prior version as active")
  .action(async (name: string, version: string) => {
    const forge = await makeForge(program.opts().dir);
    await forge.rollback(name, Number(version));
    process.stdout.write(`prompt-forge: ${name} now active at v${version}\n`);
  });

program
  .command("list")
  .description("List all prompts and their active versions")
  .action(async () => {
    const forge = await makeForge(program.opts().dir);
    const items = await forge.list();
    if (items.length === 0) {
      process.stdout.write("prompt-forge: no prompts yet\n");
      return;
    }
    for (const p of items) {
      process.stdout.write(
        `${p.name}\tactive=v${p.activeVersion}\tversions=[${p.versions.join(", ")}]\n`,
      );
    }
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`prompt-forge: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
