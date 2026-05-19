import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ScaffoldModuleResult {
  dir: string;
  files: string[];
}

function toPascal(slug: string): string {
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join("");
}

const routerTs = (slug: string) => `import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ module: "${slug}", items: [] });
});

export default router;
`;

const serviceTs = (slug: string) => {
  const p = toPascal(slug);
  return `export function create${p}Service() {
  return {
    async list() {
      return [];
    },
  };
}
`;
};

/** Create \`src/modules/<slug>/\` with \`*.router.ts\` + \`*.service.ts\` stubs. */
export async function scaffoldModule(name: string, cwd = process.cwd()): Promise<ScaffoldModuleResult> {
  const slug = name.trim().replace(/[^a-zA-Z0-9-_]/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("backendforge: invalid module name");
  const dir = path.join(cwd, "src", "modules", slug);
  await mkdir(dir, { recursive: true });
  const routerFile = path.join(dir, `${slug}.router.ts`);
  const serviceFile = path.join(dir, `${slug}.service.ts`);
  await writeFile(routerFile, routerTs(slug), "utf8");
  await writeFile(serviceFile, serviceTs(slug), "utf8");
  return { dir, files: [routerFile, serviceFile] };
}
