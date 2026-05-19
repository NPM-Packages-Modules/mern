import type { ZodIssue } from "zod";

export interface InvalidVar {
  readonly name: string;
  readonly received: unknown;
  readonly issues: readonly ZodIssue[];
}

export class EnvValidationError extends Error {
  readonly invalid: readonly InvalidVar[];

  constructor(invalid: readonly InvalidVar[]) {
    super(EnvValidationError.formatMessage(invalid));
    this.name = "EnvValidationError";
    this.invalid = invalid;
    Object.setPrototypeOf(this, EnvValidationError.prototype);
  }

  static formatMessage(invalid: readonly InvalidVar[]): string {
    const lines = [
      `Invalid environment variables (${invalid.length} issue${invalid.length === 1 ? "" : "s"}):`,
    ];
    for (const v of invalid) {
      const received =
        v.received === undefined
          ? "<missing>"
          : JSON.stringify(v.received);
      for (const issue of v.issues) {
        lines.push(`  - ${v.name}: ${issue.message} (received: ${received})`);
      }
    }
    return lines.join("\n");
  }
}

export class InvalidAccessError extends Error {
  constructor(varName: string) {
    super(
      `Attempted to access server-only env var "${varName}" on the client. ` +
        `Move it to the "server" object only if access is required server-side.`,
    );
    this.name = "InvalidAccessError";
    Object.setPrototypeOf(this, InvalidAccessError.prototype);
  }
}
