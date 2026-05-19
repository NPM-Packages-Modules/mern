import pc from "picocolors";
import type { ErrorReport, ParsedError } from "./types.js";

export function formatReport(report: ErrorReport, options: { color?: boolean } = {}): string {
  const color = options.color ?? true;
  const c = color ? pc : noColor();
  const lines: string[] = [];
  lines.push(
    `${c.red(c.bold(`✗ ${report.error.name}`))}: ${report.error.message}`,
  );
  lines.push(c.dim(`  fingerprint=${report.fingerprint}  at=${report.occurredAt}`));
  if (report.request) {
    lines.push(
      c.dim(`  request=${report.request.method} ${report.request.path}`),
    );
  }
  if (report.error.code) lines.push(c.dim(`  code=${report.error.code}`));
  if (report.hints.length > 0) {
    lines.push(c.yellow("  Hints:"));
    for (const h of report.hints) lines.push(`    • ${h}`);
  }
  if (report.suggestedFix) {
    lines.push(c.green(`  Suggested fix: ${report.suggestedFix}`));
  }
  const top = report.error.frames.slice(0, 5);
  if (top.length > 0) {
    lines.push(c.dim("  Stack:"));
    for (const f of top) {
      const where = f.line ? `:${f.line}${f.column ? `:${f.column}` : ""}` : "";
      const marker = f.inApp ? "•" : f.isNative ? "·" : " ";
      lines.push(`    ${marker} ${f.function} (${f.file}${where})`);
    }
  }
  if (report.error.cause) {
    lines.push(c.dim("  Caused by:"));
    lines.push(`    ${report.error.cause.name}: ${report.error.cause.message}`);
  }
  return lines.join("\n");
}

export function reportToJSON(report: ErrorReport): Record<string, unknown> {
  return JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
}

export function reportToGithubIssue(report: ErrorReport): { title: string; body: string } {
  const title = `[${report.error.name}] ${report.error.message.slice(0, 120)}`;
  const stack = report.error.frames
    .slice(0, 10)
    .map((f) => `- \`${f.function}\` — \`${f.file}${f.line ? `:${f.line}` : ""}\``)
    .join("\n");
  const body = [
    `**Fingerprint:** \`${report.fingerprint}\`  `,
    `**Occurred at:** ${report.occurredAt}  `,
    report.request ? `**Request:** \`${report.request.method} ${report.request.path}\`` : "",
    "",
    `### Message`,
    "```",
    `${report.error.name}: ${report.error.message}`,
    "```",
    "",
    report.hints.length ? `### Hints\n${report.hints.map((h) => `- ${h}`).join("\n")}` : "",
    report.suggestedFix ? `### Suggested fix\n${report.suggestedFix}` : "",
    "",
    `### Stack (top)\n${stack || "_no stack_"}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { title, body };
}

function noColor() {
  const ident = (s: string) => s;
  return new Proxy(
    {},
    {
      get() {
        return ident;
      },
    },
  ) as typeof pc;
}

export function rootCauseSummary(err: ParsedError): string {
  if (err.cause) {
    return `${err.name}: ${err.message} <- ${rootCauseSummary(err.cause)}`;
  }
  return `${err.name}: ${err.message}`;
}
