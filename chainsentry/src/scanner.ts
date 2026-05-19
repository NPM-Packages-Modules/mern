import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  findTyposquatCandidate,
  maxSeverity,
  scoreInstallScript,
} from "./scoring.js";
import { fetchPackument, type RegistryPackument } from "./registry.js";
import { TOP_PACKAGES } from "./top-packages.js";
import type {
  Finding,
  PackageRisk,
  RiskLevel,
  ScanOptions,
  ScanResult,
} from "./types.js";

interface InstalledPackage {
  name: string;
  version: string;
  dir: string;
  pkgJson: {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    maintainers?: Array<{ name: string; email?: string }>;
  };
}

function readJsonSafe(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function findInstalled(root: string, depth: "direct" | "all"): InstalledPackage[] {
  const nm = join(root, "node_modules");
  if (!existsSync(nm)) return [];
  const out: InstalledPackage[] = [];
  const visited = new Set<string>();

  const walk = (dir: string, level: number): void => {
    if (visited.has(dir)) return;
    visited.add(dir);
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".")) continue;
      const pkgDir = join(dir, entry);
      try {
        const stat = statSync(pkgDir);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }
      if (entry.startsWith("@")) {
        for (const sub of readdirSync(pkgDir)) {
          handle(join(pkgDir, sub), `${entry}/${sub}`, level);
        }
      } else {
        handle(pkgDir, entry, level);
      }
    }
  };

  const handle = (pkgDir: string, name: string, level: number): void => {
    const pj = readJsonSafe(join(pkgDir, "package.json"));
    if (!pj) return;
    out.push({
      name: (pj.name as string) ?? name,
      version: (pj.version as string) ?? "0.0.0",
      dir: pkgDir,
      pkgJson: pj as InstalledPackage["pkgJson"],
    });
    if (depth === "all" && existsSync(join(pkgDir, "node_modules"))) {
      walk(join(pkgDir, "node_modules"), level + 1);
    }
  };

  walk(nm, 0);
  return out;
}

function loadBaseline(): Record<string, { maintainers: string[] }> {
  const file = join(homedir(), ".depguard", "baseline.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, { maintainers: string[] }>;
  } catch {
    return {};
  }
}

const INSTALL_SCRIPT_FIELDS = ["preinstall", "install", "postinstall", "preuninstall", "preprepare", "prepare"] as const;

function scriptFindings(pkg: InstalledPackage): Finding[] {
  const findings: Finding[] = [];
  const scripts = pkg.pkgJson.scripts ?? {};
  for (const field of INSTALL_SCRIPT_FIELDS) {
    const src = scripts[field];
    if (!src) continue;
    const { score, reasons } = scoreInstallScript(src);
    if (score === 0) continue;
    const severity: RiskLevel =
      score >= 8 ? "critical" : score >= 5 ? "high" : score >= 3 ? "medium" : "low";
    findings.push({
      rule: `install-script:${field}`,
      severity,
      message: `${field} script is suspicious (${reasons.join("; ")})`,
      score,
    });
  }
  return findings;
}

function maintainerFindings(
  pkg: InstalledPackage,
  packument: RegistryPackument | undefined,
  baseline: Record<string, { maintainers: string[] }>,
): Finding[] {
  if (!packument?.maintainers) return [];
  const now = packument.maintainers.map((m) => m.name).sort();
  const known = baseline[pkg.name]?.maintainers;
  if (!known) return [];
  const added = now.filter((m) => !known.includes(m));
  if (added.length === 0) return [];
  return [{
    rule: "maintainer-change",
    severity: "high",
    message: `New maintainer(s) added since baseline: ${added.join(", ")}`,
    score: 6,
  }];
}

function versionAnomalyFindings(
  pkg: InstalledPackage,
  packument: RegistryPackument | undefined,
): Finding[] {
  if (!packument?.time) return [];
  const out: Finding[] = [];
  const time = packument.time;
  const versions = Object.keys(time).filter((k) => k !== "created" && k !== "modified");

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const major = new Map<number, string[]>();
  for (const v of versions) {
    const m = /^(\d+)\./.exec(v);
    if (!m) continue;
    const key = Number(m[1]);
    const arr = major.get(key) ?? [];
    arr.push(v);
    major.set(key, arr);
  }
  const keys = [...major.keys()].sort((a, b) => a - b);
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1]!;
    const cur = keys[i]!;
    const prevReleases = major.get(prev)!.map((v) => Date.parse(time[v] ?? "")).filter(Number.isFinite);
    const curReleases = major.get(cur)!.map((v) => Date.parse(time[v] ?? "")).filter(Number.isFinite);
    if (prevReleases.length === 0 || curReleases.length === 0) continue;
    const lastPrev = Math.max(...prevReleases);
    const firstCur = Math.min(...curReleases);
    if (firstCur - lastPrev < sevenDays) {
      out.push({
        rule: "version-anomaly",
        severity: "medium",
        message: `Major bump v${prev} → v${cur} within 7 days (potential takeover)`,
        score: 4,
      });
    }
  }

  const created = Date.parse(time.created ?? "");
  if (Number.isFinite(created) && Date.now() - created < 30 * 24 * 60 * 60 * 1000) {
    out.push({
      rule: "young-package",
      severity: "low",
      message: "Package was first published less than 30 days ago",
      score: 2,
    });
  }
  return out;
}

function typosquatFindings(name: string): Finding[] {
  const sug = findTyposquatCandidate(name, TOP_PACKAGES);
  if (!sug) return [];
  return [{
    rule: "typosquat",
    severity: "critical",
    message: `Name closely resembles "${sug}" — likely typosquat`,
    score: 10,
  }];
}

export async function scan(options: ScanOptions = {}): Promise<ScanResult> {
  const cwd = options.cwd ?? process.cwd();
  const depth = options.scanDepth ?? "all";
  const ignore = new Set(options.ignore ?? []);
  const baseline = loadBaseline();
  const startedAt = new Date().toISOString();
  const packages: PackageRisk[] = [];

  const installed = findInstalled(cwd, depth).filter((p) => !ignore.has(p.name));
  for (const pkg of installed) {
    const findings: Finding[] = [];
    findings.push(...scriptFindings(pkg));
    findings.push(...typosquatFindings(pkg.name));

    if (options.network !== false) {
      const packument = await fetchPackument(pkg.name, { ttlMs: options.cacheTTL ?? 60 * 60 * 1000 });
      findings.push(...maintainerFindings(pkg, packument, baseline));
      findings.push(...versionAnomalyFindings(pkg, packument));
    }

    if (findings.length === 0) continue;
    packages.push({
      name: pkg.name,
      version: pkg.version,
      worstSeverity: maxSeverity(findings),
      totalScore: findings.reduce((s, f) => s + f.score, 0),
      findings,
    });
  }

  packages.sort((a, b) => b.totalScore - a.totalScore);

  return {
    packages,
    scannedAt: startedAt,
    generatedAt: new Date().toISOString(),
    totalPackages: installed.length,
  };
}

export async function audit(name: string): Promise<PackageRisk | undefined> {
  const packument = await fetchPackument(name);
  if (!packument) return undefined;
  const findings: Finding[] = [];
  findings.push(...typosquatFindings(name));
  return {
    name,
    version: packument["dist-tags"]?.latest ?? "0.0.0",
    worstSeverity: maxSeverity(findings),
    totalScore: findings.reduce((s, f) => s + f.score, 0),
    findings,
  };
}
