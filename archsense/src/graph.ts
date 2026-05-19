import type { DependencyGraph, ModuleInfo } from "./types.js";
import { resolveImport } from "./parse.js";

export function buildGraph(modules: ModuleInfo[], rootDir: string): DependencyGraph {
  const moduleMap = new Map<string, ModuleInfo>();
  const edges = new Map<string, Set<string>>();
  for (const m of modules) {
    moduleMap.set(m.file, m);
    edges.set(m.file, new Set());
  }
  for (const m of modules) {
    for (const spec of m.imports) {
      const resolved = resolveImport(m.file, spec, rootDir);
      if (!resolved) continue;
      if (!moduleMap.has(resolved)) continue;
      edges.get(m.file)!.add(resolved);
    }
  }
  return { modules: moduleMap, edges };
}

export function findCycles(graph: DependencyGraph, max = 50): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (cycles.length >= max) return;
    if (stack.has(node)) {
      const start = path.indexOf(node);
      if (start !== -1) {
        const cycle = path.slice(start);
        cycle.push(node);
        if (!cycleExists(cycles, cycle)) cycles.push(cycle);
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    path.push(node);
    const neighbors = graph.edges.get(node) ?? new Set();
    for (const n of neighbors) {
      dfs(n);
      if (cycles.length >= max) break;
    }
    stack.delete(node);
    path.pop();
  }

  for (const node of graph.edges.keys()) {
    if (cycles.length >= max) break;
    dfs(node);
  }
  return cycles;
}

function cycleExists(cycles: string[][], candidate: string[]): boolean {
  const normalized = normalizeCycle(candidate);
  return cycles.some((c) => normalizeCycle(c) === normalized);
}

function normalizeCycle(cycle: string[]): string {
  if (cycle.length === 0) return "";
  const trimmed = cycle.slice(0, -1);
  let minIdx = 0;
  for (let i = 1; i < trimmed.length; i++) {
    if ((trimmed[i] ?? "") < (trimmed[minIdx] ?? "")) minIdx = i;
  }
  return [...trimmed.slice(minIdx), ...trimmed.slice(0, minIdx)].join("->");
}

export function fanIn(graph: DependencyGraph): Map<string, number> {
  const map = new Map<string, number>();
  for (const node of graph.edges.keys()) map.set(node, 0);
  for (const [, targets] of graph.edges) {
    for (const t of targets) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return map;
}

export function fanOut(graph: DependencyGraph): Map<string, number> {
  const map = new Map<string, number>();
  for (const [node, targets] of graph.edges) map.set(node, targets.size);
  return map;
}
