const VAR_REGEX = /\{\{\s*([a-zA-Z_$][\w$.]*)\s*\}\}/g;

export function extractVariables(content: string): string[] {
  const out = new Set<string>();
  VAR_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAR_REGEX.exec(content)) !== null) {
    if (m[1]) out.add(m[1]);
  }
  return Array.from(out);
}

export function renderTemplate(template: string, variables: Record<string, unknown> = {}): string {
  return template.replace(VAR_REGEX, (_match, name: string) => {
    const value = resolvePath(variables, name);
    if (value === undefined || value === null) {
      throw new Error(`Missing template variable: ${name}`);
    }
    return String(value);
  });
}

function resolvePath(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = source;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}
