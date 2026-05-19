# archsense

Backend architecture intelligence for any Node/TypeScript codebase. Run one command and get an architecture score, a dependency graph, cycle detection, leaked-secret scanning, oversized-file alerts, missing-test detection, and concrete fix suggestions.

## Install

```bash
npm install -D @mr-aftab-ahmad-khan/archsense
```

Or run without installing:

```bash
npx @mr-aftab-ahmad-khan/archsense audit
```

## CLI

```bash
archsense audit ./src --fail-on warn
archsense score ./
archsense graph --json > graph.json
```

### Output

```
archsense (/Users/me/app)
  files=164  LOC=8420  edges=312  cycles=2
  score: 72/100  grade: C

  circular-dependency ×2
    [error] Circular dependency: src/orders/index.ts → src/users/index.ts → src/orders/index.ts
      → Introduce an interface module, invert one import direction, …

  oversized-file ×4
    [warn] src/services/scheduler.ts is 612 LOC (limit 400).
      → Split into smaller modules; group related helpers.

  leaked-secret ×1
    [error] Possible AWS Access Key found in src/config/staging.ts.
      → Rotate the secret immediately and move it to environment variables.
```

## What it detects

| Finding | What |
| --- | --- |
| `circular-dependency` | Cycles in your import graph |
| `oversized-file` | Files past `maxFileLOC` |
| `god-folder` | Folders past `godFolderThreshold` |
| `deep-nesting` | Files buried past `deepNestingThreshold` |
| `duplicate-filename` | Multiple `user.ts`, `service.ts`, etc. across the tree |
| `high-fan-in` / `high-fan-out` | Hub modules and over-eager coordinators |
| `missing-tests` | Source modules with no `*.test.*` / `*.spec.*` sibling |
| `wildcard-imports` | `import "x/*"` patterns that break tree-shaking |
| `leaked-secret` | AWS, GitHub, Slack, Stripe, Google, JWT, private keys |

## Programmatic API

```ts
import { audit, findCycles, buildGraph } from "@mr-aftab-ahmad-khan/archsense";

const report = audit({ rootDir: process.cwd(), ignore: ["node_modules", "dist"] });
console.log(report.score, report.grade);
for (const f of report.findings) console.log(f.kind, f.message);
```

### `audit(options): AuditReport`

```ts
audit({
  rootDir: process.cwd(),
  ignore: ["dist", ".turbo"],
  maxFileLOC: 400,
  godFolderThreshold: 30,
  highFanOut: 15,
  highFanIn: 20,
  deepNestingThreshold: 7,
  enableSecretScan: true,
});
```

### Returned report

```ts
interface AuditReport {
  rootDir: string;
  filesScanned: number;
  totalLOC: number;
  findings: Finding[];
  score: number;            // 0..100
  grade: "A" | "B" | "C" | "D" | "F";
  graph: { nodes: number; edges: number; cycles: string[] };
}
```

## CI usage

```yaml
- run: npx @mr-aftab-ahmad-khan/archsense audit --fail-on error
```

Fail the build only on errors (cycles, leaked secrets), or be stricter with `warn` / `info`.

## License

MIT
