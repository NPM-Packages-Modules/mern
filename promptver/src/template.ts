/** Render a `{{var}}` style template with the provided variable bag. */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g, (_match, expr: string) => {
    const path = expr.split(".");
    let val: unknown = vars;
    for (const seg of path) {
      if (val == null || typeof val !== "object") return "";
      val = (val as Record<string, unknown>)[seg];
    }
    return val == null ? "" : String(val);
  });
}

export function extractVariableNames(template: string): string[] {
  const names = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
  for (let m = re.exec(template); m !== null; m = re.exec(template)) {
    if (m[1]) names.add(m[1].split(".")[0]!);
  }
  return [...names];
}
