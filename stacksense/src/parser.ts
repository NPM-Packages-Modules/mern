import type { ParsedError, StackFrame } from "./types.js";

const FRAME_REGEX = /^\s*at\s+(?:(.+?)\s+\()?(.+?)(?::(\d+))?(?::(\d+))?\)?\s*$/;

export function parseStack(stack: string | undefined, appRoots: string[] = []): StackFrame[] {
  if (!stack) return [];
  const lines = stack.split("\n").slice(1);
  const frames: StackFrame[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("at ")) continue;
    const m = trimmed.match(FRAME_REGEX);
    if (!m) continue;
    const fn = (m[1] ?? "<anonymous>").trim();
    let file = (m[2] ?? "").trim();
    if (file.endsWith(")")) file = file.slice(0, -1);
    const lineNum = m[3] ? Number(m[3]) : undefined;
    const colNum = m[4] ? Number(m[4]) : undefined;
    const isNative = file === "native" || file.startsWith("node:") || file.includes("internal/");
    const inApp = !isNative && !file.includes("node_modules") && matchesAppRoot(file, appRoots);
    frames.push({
      function: fn,
      file,
      line: lineNum,
      column: colNum,
      inApp,
      isNative,
      raw: trimmed,
    });
  }
  return frames;
}

function matchesAppRoot(file: string, roots: string[]): boolean {
  if (roots.length === 0) return true;
  return roots.some((root) => file.includes(root));
}

export function parseError(err: unknown, appRoots: string[] = [], depth = 0): ParsedError {
  if (depth > 5) {
    return { name: "Error", message: "[max cause depth]", frames: [] };
  }
  if (err instanceof Error) {
    const code = (err as unknown as { code?: unknown }).code;
    const parsed: ParsedError = {
      name: err.name || "Error",
      message: err.message || "",
      code: typeof code === "string" ? code : undefined,
      frames: parseStack(err.stack, appRoots),
    };
    const cause = (err as unknown as { cause?: unknown }).cause;
    if (cause !== undefined && cause !== null) {
      parsed.cause = parseError(cause, appRoots, depth + 1);
    }
    return parsed;
  }
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : "Object",
      message: typeof obj.message === "string" ? obj.message : JSON.stringify(err),
      frames: [],
    };
  }
  return {
    name: "Thrown",
    message: typeof err === "string" ? err : String(err),
    frames: [],
  };
}

export function findOriginFrame(err: ParsedError): StackFrame | undefined {
  return err.frames.find((f) => f.inApp) ?? err.frames[0];
}
