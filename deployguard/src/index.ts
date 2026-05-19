import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type CheckResult = { name: string; ok: boolean; detail?: string };

export function parseEnvExampleKeys(text: string): string[] {
  const keys: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = /^([A-Z_][A-Z0-9_]*)\s*=/.exec(t);
    if (m?.[1]) keys.push(m[1]);
  }
  return keys;
}

export async function checkEnvTemplate(root: string): Promise<CheckResult> {
  const p = resolve(root, ".env.example");
  try {
    const txt = await readFile(p, "utf8");
    const keys = parseEnvExampleKeys(txt);
    if (keys.length === 0) return { name: "env-example", ok: false, detail: "no keys parsed in .env.example" };
    const missing = keys.filter((k) => process.env[k] === undefined || process.env[k] === "");
    if (missing.length)
      return {
        name: "env-example",
        ok: false,
        detail: `missing in process.env: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`,
      };
    return { name: "env-example", ok: true, detail: `${keys.length} key(s) present` };
  } catch {
    return { name: "env-example", ok: false, detail: ".env.example not readable" };
  }
}

export async function checkDockerfile(root: string): Promise<CheckResult> {
  try {
    const txt = await readFile(resolve(root, "Dockerfile"), "utf8");
    const ok = /FROM\s+/i.test(txt) && /CMD|ENTRYPOINT/i.test(txt);
    return { name: "dockerfile", ok, detail: ok ? "basic instructions present" : "missing CMD/ENTRYPOINT" };
  } catch {
    return { name: "dockerfile", ok: true, detail: "skipped — no Dockerfile" };
  }
}

export async function checkPackageFootprint(root: string): Promise<CheckResult> {
  try {
    const raw = await readFile(resolve(root, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const n = Object.keys(pkg.dependencies ?? {}).length;
    const roughMb = Math.round(n * 2);
    return {
      name: "deps-weight",
      ok: n < 200,
      detail: `${n} prod deps — rough image budget hint ~${roughMb}–${roughMb * 2}MB before tree shaping`,
    };
  } catch (e) {
    return { name: "deps-weight", ok: false, detail: String(e) };
  }
}

/** Optional Mongo ping when `mongodb` is installed and URI env is set. */
export async function checkMongoUri(): Promise<CheckResult> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? process.env.DATABASE_URL;
  if (!uri?.startsWith("mongodb")) return { name: "mongo-uri", ok: true, detail: "skipped — no mongodb* URI" };
  try {
    const { MongoClient } = await import("mongodb");
    const c = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 });
    await c.connect();
    await c.db().command({ ping: 1 });
    await c.close();
    return { name: "mongo-uri", ok: true, detail: "ping ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
      return { name: "mongo-uri", ok: true, detail: "skipped — install `mongodb` to enable ping" };
    }
    return { name: "mongo-uri", ok: false, detail: msg };
  }
}

export async function runAllChecks(root: string): Promise<CheckResult[]> {
  return Promise.all([checkEnvTemplate(root), checkDockerfile(root), checkPackageFootprint(root), checkMongoUri()]);
}
