import { basename, dirname } from "node:path";
import { readFile, relativeFrom, topFolderOf, walkFiles } from "./fs.js";
import { buildModuleInfo } from "./parse.js";
import { buildGraph, fanIn, fanOut, findCycles } from "./graph.js";
import { scanForSecrets } from "./secrets.js";
import type { AuditOptions, AuditReport, Finding, ModuleInfo } from "./types.js";

const DEFAULTS = {
  maxFileLOC: 400,
  godFolderThreshold: 30,
  highFanOut: 15,
  highFanIn: 20,
  deepNestingThreshold: 7,
  enableSecretScan: true,
};

export function audit(options: AuditOptions): AuditReport {
  const opts = { ...DEFAULTS, ...options };
  const files = walkFiles(opts.rootDir, { ignore: opts.ignore });
  const modules: ModuleInfo[] = files.map((file) => buildModuleInfo(file, readFile(file)));
  const graph = buildGraph(modules, opts.rootDir);
  const findings: Finding[] = [];

  for (const m of modules) {
    const rel = relativeFrom(opts.rootDir, m.file);
    if (m.loc > opts.maxFileLOC) {
      findings.push({
        kind: "oversized-file",
        severity: m.loc > opts.maxFileLOC * 2 ? "error" : "warn",
        message: `${rel} is ${m.loc} LOC (limit ${opts.maxFileLOC}).`,
        suggestion: "Split into smaller modules; group related helpers.",
        files: [rel],
      });
    }
    const depth = rel.split("/").length;
    if (depth > opts.deepNestingThreshold) {
      findings.push({
        kind: "deep-nesting",
        severity: "info",
        message: `${rel} sits ${depth} folders deep.`,
        suggestion: "Flatten folder structure; folders should describe concepts, not steps.",
        files: [rel],
      });
    }
  }

  const cycles = findCycles(graph);
  for (const cycle of cycles) {
    const rel = cycle.map((f) => relativeFrom(opts.rootDir, f));
    findings.push({
      kind: "circular-dependency",
      severity: "error",
      message: `Circular dependency: ${rel.join(" → ")}`,
      suggestion:
        "Introduce an interface module, invert one import direction, or move the shared types to a leaf file.",
      files: rel,
    });
  }

  const folderCounts = new Map<string, string[]>();
  for (const m of modules) {
    const folder = topFolderOf(opts.rootDir, m.file);
    const arr = folderCounts.get(folder) ?? [];
    arr.push(relativeFrom(opts.rootDir, m.file));
    folderCounts.set(folder, arr);
  }
  for (const [folder, list] of folderCounts) {
    if (list.length > opts.godFolderThreshold) {
      findings.push({
        kind: "god-folder",
        severity: "warn",
        message: `Folder ${folder} contains ${list.length} files.`,
        suggestion:
          "Split by domain (e.g., 'users/', 'orders/') instead of by technical role.",
        files: list,
      });
    }
  }

  const duplicates = new Map<string, string[]>();
  for (const m of modules) {
    const name = basename(m.file).toLowerCase();
    if (name.startsWith("index.")) continue;
    const arr = duplicates.get(name) ?? [];
    arr.push(relativeFrom(opts.rootDir, m.file));
    duplicates.set(name, arr);
  }
  for (const [name, list] of duplicates) {
    if (list.length > 1) {
      findings.push({
        kind: "duplicate-filename",
        severity: "info",
        message: `Duplicate filename ${name} (${list.length} copies).`,
        suggestion: "Prefer unique names so logs and stack traces stay unambiguous.",
        files: list,
      });
    }
  }

  const inMap = fanIn(graph);
  const outMap = fanOut(graph);
  for (const [node, count] of outMap) {
    if (count > opts.highFanOut) {
      findings.push({
        kind: "high-fan-out",
        severity: "warn",
        message: `${relativeFrom(opts.rootDir, node)} imports ${count} modules.`,
        suggestion: "High fan-out signals a coordinator that is doing too much; extract responsibilities.",
        files: [relativeFrom(opts.rootDir, node)],
      });
    }
  }
  for (const [node, count] of inMap) {
    if (count > opts.highFanIn) {
      findings.push({
        kind: "high-fan-in",
        severity: "info",
        message: `${relativeFrom(opts.rootDir, node)} is imported by ${count} modules.`,
        suggestion: "Stable, infrastructure-like modules can have high fan-in; otherwise hide behind a public boundary.",
        files: [relativeFrom(opts.rootDir, node)],
      });
    }
  }

  const tested = new Set<string>();
  for (const file of files) {
    const name = basename(file);
    if (/\.(test|spec)\./.test(name) || dirname(file).includes("__tests__")) {
      const subject = name.replace(/\.(test|spec)\.[tj]sx?$/, "");
      tested.add(subject);
    }
  }
  for (const m of modules) {
    const name = basename(m.file).replace(/\.[tj]sx?$/, "");
    if (m.exports.length === 0 && !m.hasDefaultExport) continue;
    if (/\.(test|spec)$/.test(name)) continue;
    if (m.loc < 20) continue;
    if (!tested.has(name)) {
      findings.push({
        kind: "missing-tests",
        severity: "info",
        message: `${relativeFrom(opts.rootDir, m.file)} has no matching test file.`,
        suggestion: `Add ${name}.test.ts or ${name}.spec.ts next to it.`,
        files: [relativeFrom(opts.rootDir, m.file)],
      });
    }
  }

  for (const m of modules) {
    for (const imp of m.imports) {
      if (imp.endsWith("*")) {
        findings.push({
          kind: "wildcard-imports",
          severity: "info",
          message: `Wildcard import in ${relativeFrom(opts.rootDir, m.file)}: ${imp}`,
          suggestion: "Prefer explicit imports to keep tree-shaking effective.",
          files: [relativeFrom(opts.rootDir, m.file)],
        });
      }
    }
  }

  if (opts.enableSecretScan) {
    for (const file of files) {
      const content = readFile(file);
      const hits = scanForSecrets(content);
      for (const name of hits) {
        findings.push({
          kind: "leaked-secret",
          severity: "error",
          message: `Possible ${name} found in ${relativeFrom(opts.rootDir, file)}.`,
          suggestion: "Rotate the secret immediately and move it to environment variables.",
          files: [relativeFrom(opts.rootDir, file)],
        });
      }
    }
  }

  const totalLOC = modules.reduce((s, m) => s + m.loc, 0);
  const score = computeScore(findings, files.length);
  const grade = scoreToGrade(score);
  const edgeCount = Array.from(graph.edges.values()).reduce((s, e) => s + e.size, 0);
  const cycleRel = cycles.map((c) => c.map((f) => relativeFrom(opts.rootDir, f)));

  return {
    rootDir: opts.rootDir,
    filesScanned: files.length,
    totalLOC,
    findings,
    score,
    grade,
    graph: { nodes: graph.modules.size, edges: edgeCount, cycles: cycleRel.map((c) => c.join(" -> ")) },
  };
}

export function computeScore(findings: Finding[], fileCount: number): number {
  if (fileCount === 0) return 100;
  const weights: Record<Finding["severity"], number> = { info: 0.4, warn: 1.4, error: 3.5 };
  let penalty = 0;
  for (const f of findings) penalty += weights[f.severity];
  const normalized = penalty / fileCount;
  return Math.max(0, Math.min(100, Math.round(100 - normalized * 18)));
}

export function scoreToGrade(score: number): AuditReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
