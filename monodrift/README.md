# monodrift

**Topics:** `cli` · `dependencies` · `dependency` · `drift` · `mern-packages` · `merndev` · `monodrift` · `monorepo` · `nodejs` · `npm` · `npm-pm` · `observability` · `pnpm` · `typescript` · `version` · `workspace` · `workspaces` · `yarn`

[![npm version](https://img.shields.io/npm/v/monodrift.svg)](https://www.npmjs.com/package/monodrift)
[![license](https://img.shields.io/npm/l/monodrift.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**In a 10-package monorepo, React will be at 3 different versions within 6 months.** `monodrift` catches version drift across **pnpm**, **npm**, and **yarn** workspaces in CI before it becomes a Saturday-night debugging session. Auto-detects workspace format, classifies drift as patch/minor/major, fixes in place, and integrates with GitHub Actions, GitLab CI, Turborepo, and husky.

---

## Installation

```bash
npm install -g monodrift
pnpm add -g monodrift
yarn global add monodrift

# Or one-off:
npx monodrift
```

---

## Quick Start

```bash
$ npx monodrift
monodrift — 2 drifted package(s) across 3 workspaces

  MINOR  react
    - ^18.2.0  (apps/web / dependencies)
    - ^18.3.1  (packages/ui / dependencies)
    - ^18.3.1  (packages/forms / dependencies)

  MAJOR  zod
    - ^3.22.4  (apps/web / dependencies)
    - ^4.0.0   (packages/ui / dependencies)
```

---

## Core Usage Examples

### 1. Scan and read the report

```bash
monodrift
```

### 2. Auto-fix to the highest currently used

```bash
monodrift fix
# Then run your package manager's install:
#   pnpm install   /   npm install   /   yarn install
```

### 3. Dry-run

```bash
monodrift fix --dry-run
```

### 4. Ignore an intentional mismatch

```bash
monodrift ignore @types/node
```

### 5. Fix one package across the monorepo

```bash
monodrift fix --pkg react
```

### 6. JSON output

```bash
monodrift report --format json | jq '.drifted[] | select(.severity == "major")'
```

---

## CI/CD Integration Examples

### GitHub Actions

```yaml
name: drift
on: [pull_request]
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx monodrift --fail-on minor
```

### GitLab CI

```yaml
drift:
  stage: test
  image: node:20
  script:
    - npx monodrift --fail-on minor
```

### Turborepo

```json
// turbo.json
{
  "pipeline": {
    "drift": { "outputs": [] }
  }
}
```

```json
// package.json
{ "scripts": { "drift": "monodrift --fail-on minor" } }
```

### Pre-push hook (husky)

```bash
# .husky/pre-push
#!/bin/sh
npx monodrift --fail-on major
```

---

## Configuration Reference

`.driftrc.json`:

```json
{
  "failOn": "minor",
  "ignore": ["@types/node"],
  "workspaceGlobs": ["packages/*", "apps/*", "tools/*"]
}
```

| Option           | Type        | Default                       | Description                              |
| ---------------- | ----------- | ----------------------------- | ---------------------------------------- |
| `failOn`         | `Severity`  | `undefined`                   | Exit 1 when any drift ≥ this severity    |
| `ignore`         | `string[]`  | `[]`                          | Package names to skip                    |
| `workspaceGlobs` | `string[]`  | `["packages/*","apps/*"]`     | Extra glob patterns to scan              |

---

## `.driftignore` Format

Plain text, one package name per line, with `#` comments:

```
# Allow intentional mismatch — vue 3 in legacy app
vue

# Type packages drift independently of runtime versions
@types/node
```

---

## TypeScript Types

```ts
import { scan, planFix, applyFix, type DriftReport, type Severity } from "monodrift";

const report: DriftReport = scan({ cwd: process.cwd() });
for (const d of report.drifted) {
  console.log(d.name, d.severity, d.versions.length, "versions");
}
```

---

## CLI Reference

```
monodrift scan [options]               (default command)
  --format <fmt>           pretty | json (default pretty)
  --fail-on <severity>     patch | minor | major

monodrift fix [options]
  --target <target>        version string or 'latest' (default 'latest')
  --pkg <name>             limit to a single package
  --dry-run                preview only

monodrift ignore <name>
  Append a package name to .driftignore.

monodrift report [options]
  Alias for `scan --format json`.
```

Sample output:

```bash
$ monodrift fix --dry-run
  react: ^18.2.0 → ^18.3.1   /repo/apps/web/package.json
monodrift: dry-run, no files modified
```

---

## Real-World Recipe — Turborepo Monorepo with 15 Packages

```bash
# Initial scan
$ npx monodrift
monodrift — 3 drifted package(s) across 15 workspaces
  MINOR  react        (^18.2.0 vs ^18.3.1 vs ^18.3.1)
  PATCH  typescript   (5.4.0 vs 5.4.2)
  MINOR  zod          (^3.22.4 vs ^3.23.0)
```

```json
// .driftrc.json
{
  "failOn": "minor",
  "ignore": ["@internal/legacy"]
}
```

```yaml
# .github/workflows/drift.yml
name: drift
on: [pull_request]
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx monodrift --fail-on minor
```

```bash
# Developer locally
$ npx monodrift fix
  react:      ^18.2.0 → ^18.3.1   apps/web/package.json
  typescript: 5.4.0   → 5.4.2     packages/ui/package.json
  zod:        ^3.22.4 → ^3.23.0   apps/web/package.json
monodrift: updated 3 file(s). Run your package manager's install.
$ pnpm install
$ git commit -am "chore: align drifting deps"
```

```bash
# Slack notification on scheduled run
$ monodrift report --format json > drift.json
$ curl -X POST -H 'content-type: application/json' \
       -d "$(jq -c '{text: "Weekly drift: " + (.drifted | length | tostring) + " packages"}' drift.json)" \
       "$SLACK_WEBHOOK_URL"
```

---

## How Drift Happens

1. **Lazy package adds.** Someone runs `npm install foo` in a single package; whatever version npm picks today is locked there.
2. **Bulk updates without a refresh.** `pnpm update --recursive` skips ranges that already satisfy a dependency, so older ranges stay.
3. **Independent dependabot updates.** Dependabot bumps `apps/web` to `react@18.3.1` but never touches `packages/ui`.

`monodrift`'s CI integration prevents (1) by failing PRs that introduce a new mismatch; the `fix` command resolves (2) and (3) in one commit.

---

## Comparison Table

| Feature                    | Manual review | syncpack | **monodrift** |
| -------------------------- | :-----------: | :------: | :-------------: |
| Auto workspace detection   |      ❌       |    ✅    |        ✅       |
| Severity levels            |      ❌       |    ❌    |        ✅       |
| Auto-fix                   |      ❌       |    ✅    |        ✅       |
| CI integration             |      ❌       |    ✅    |        ✅       |
| Dry-run                    |      ❌       |    ⚠️    |        ✅       |
| `.driftignore`             |      ❌       |    ⚠️    |        ✅       |
| JSON output                |      ❌       |    ✅    |        ✅       |

---

## License

MIT
