import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ScaffoldOptions, TemplateDescriptor } from "./types.js";
import { blankTemplate } from "./templates/blank.js";
import { postgresTemplate } from "./templates/postgres.js";
import { stripeTemplate } from "./templates/stripe.js";
import { filesystemTemplate } from "./templates/filesystem.js";
import { restTemplate } from "./templates/rest.js";

export const TEMPLATES: Record<string, TemplateDescriptor> = {
  blank: blankTemplate,
  postgres: postgresTemplate,
  stripe: stripeTemplate,
  filesystem: filesystemTemplate,
  rest: restTemplate,
};

export function scaffold(opts: ScaffoldOptions): string {
  const tpl = TEMPLATES[opts.template];
  if (!tpl) throw new Error(`Unknown template: ${opts.template}`);
  const target = resolve(opts.target ?? opts.name);
  if (existsSync(target) && readdirSync(target).length > 0) {
    throw new Error(`Target directory is not empty: ${target}`);
  }
  mkdirSync(target, { recursive: true });
  for (const file of tpl.files(opts)) {
    const out = join(target, file.path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, file.contents, "utf8");
  }
  return target;
}
