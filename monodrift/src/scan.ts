import { loadWorkspaces, readDriftIgnore } from "./workspace.js";
import { highestRange, maxSeverity, severity } from "./semver.js";
import type { DepField, DriftReport, DriftedDependency, ScanOptions, Severity } from "./types.js";

const FIELDS: DepField[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export function scan(options: ScanOptions = {}): DriftReport {
  const cwd = options.cwd ?? process.cwd();
  const workspaces = loadWorkspaces(cwd, options.workspaceGlobs);
  const ignore = new Set([...(options.ignore ?? []), ...readDriftIgnore(cwd)]);

  const byDep = new Map<string, DriftedDependency["versions"]>();
  for (const ws of workspaces) {
    for (const field of FIELDS) {
      for (const [name, version] of Object.entries(ws[field])) {
        if (ignore.has(name)) continue;
        const list = byDep.get(name) ?? [];
        list.push({ workspace: ws.name, version, field, path: ws.packageJsonPath });
        byDep.set(name, list);
      }
    }
  }

  const drifted: DriftedDependency[] = [];
  for (const [name, occurrences] of byDep) {
    const unique = [...new Set(occurrences.map((o) => o.version))];
    if (unique.length <= 1) continue;
    const severities: Severity[] = [];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const s = severity(unique[i]!, unique[j]!);
        if (s !== "none") severities.push(s);
      }
    }
    drifted.push({
      name,
      severity: maxSeverity(severities),
      versions: occurrences,
    });
  }

  drifted.sort((a, b) => a.name.localeCompare(b.name));
  return { workspaces, drifted, generatedAt: new Date().toISOString() };
}

export interface FixPlan {
  changes: {
    path: string;
    field: DepField;
    name: string;
    from: string;
    to: string;
  }[];
}

export function planFix(report: DriftReport, options: { only?: string; target?: "latest" | string } = {}): FixPlan {
  const changes: FixPlan["changes"] = [];
  for (const d of report.drifted) {
    if (options.only && d.name !== options.only) continue;
    const target = options.target && options.target !== "latest" ? options.target : highestRange(d.versions.map((v) => v.version));
    for (const v of d.versions) {
      if (v.version !== target) {
        changes.push({ path: v.path, field: v.field, name: d.name, from: v.version, to: target });
      }
    }
  }
  return { changes };
}

import { readFileSync, writeFileSync } from "node:fs";

export function applyFix(plan: FixPlan): { filesChanged: number } {
  const grouped = new Map<string, FixPlan["changes"]>();
  for (const c of plan.changes) {
    const arr = grouped.get(c.path) ?? [];
    arr.push(c);
    grouped.set(c.path, arr);
  }
  for (const [file, changes] of grouped) {
    const src = readFileSync(file, "utf8");
    let next = src;
    for (const c of changes) {
      const re = new RegExp(`("${escape(c.name)}"\\s*:\\s*")${escape(c.from)}(")`);
      next = next.replace(re, (_m, p1: string, p2: string) => `${p1}${c.to}${p2}`);
    }
    writeFileSync(file, next, "utf8");
  }
  return { filesChanged: grouped.size };
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
