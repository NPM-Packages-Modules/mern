# chainsentry

**Topics:** `audit` · `chainsentry` · `cli` · `mern-packages` · `merndev` · `nodejs` · `npm` · `npm-pm` · `observability` · `postinstall` · `scanner` · `security` · `supply-chain` · `typescript` · `typosquat`

[![npm version](https://img.shields.io/npm/v/chainsentry.svg)](https://www.npmjs.com/package/chainsentry)
[![license](https://img.shields.io/npm/l/chainsentry.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)

**A free, fast, open-source supply-chain security scanner for npm.** `chainsentry` audits your installed `node_modules` for the four attack vectors that cause real-world npm incidents:

- 🪪 **Maintainer changes** — new maintainers added since your trusted baseline
- 🧨 **Suspicious install scripts** — `preinstall`/`postinstall` lines that curl-pipe-shell, base64+eval, exfiltrate env vars, or hide behind obfuscation
- 📈 **Version anomalies** — packages that bumped a major version in under 7 days, brand-new packages claiming to be popular
- ✏️ **Typosquats** — installed names that are within Levenshtein 2 of a top-200 popular package

Socket.dev costs $19/month per developer. `chainsentry` is free and fast enough to run in your `postinstall` hook or block PRs in CI.

---

## Installation

```bash
npm install -g chainsentry
pnpm add -g chainsentry
yarn global add chainsentry

# Or one-off:
npx chainsentry scan
```

---

## Quick Start

```bash
$ chainsentry scan
chainsentry report — 2 package(s) with findings (of 412 scanned)

  HIGH  react@18.2.0  score=6
    - high  install-script:postinstall: postinstall script is suspicious (curl/wget piped to a shell or node)

  CRITICAL  reactt@0.0.1  score=10
    - critical  typosquat: Name closely resembles "react" — likely typosquat
```

---

## Core Usage Examples

### 1. Scan and read the report

```bash
chainsentry scan
```

### 2. Save a trusted baseline

```bash
chainsentry baseline
# chainsentry: baseline saved (412 packages)
```

### 3. Audit a single suspicious package

```bash
chainsentry audit reactt
# CRITICAL  reactt@0.0.1  score=10
#   - critical  typosquat: Name closely resembles "react" — likely typosquat
```

### 4. Fail PRs in CI

```bash
chainsentry scan --fail-on high
echo $?  # 1 when any package is high+ severity
```

### 5. JSON output for `jq`

```bash
chainsentry scan --format json | jq '.packages[] | select(.worstSeverity == "critical")'
```

### 6. Run on every install

```json
{
  "scripts": {
    "postinstall": "chainsentry scan --fail-on critical"
  }
}
```

---

## CI/CD Integration Examples

### GitHub Actions

```yaml
name: security
on: [pull_request]
jobs:
  chainsentry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx chainsentry scan --fail-on high
```

### GitLab CI

```yaml
chainsentry:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx chainsentry scan --fail-on high
```

### Pre-commit hook with husky

```bash
# .husky/pre-push
#!/bin/sh
npx chainsentry scan --fail-on critical
```

### postinstall

```json
{
  "scripts": {
    "postinstall": "chainsentry scan --fail-on critical --no-network"
  }
}
```

---

## Configuration Reference

`.depguardrc.json`:

```json
{
  "failOn": "high",
  "ignore": ["some-known-noisy-pkg"],
  "cacheTTL": 3600000,
  "scanDepth": "all"
}
```

| Option         | Type        | Default      | Description                                                |
| -------------- | ----------- | ------------ | ---------------------------------------------------------- |
| `failOn`       | `RiskLevel` | `undefined`  | Exit code 1 when any package's worst severity ≥ this level |
| `ignore`       | `string[]`  | `[]`         | Package names to skip                                       |
| `baselinePath` | `string`    | `~/.chainsentry/baseline.json` | Custom baseline location                       |
| `cacheTTL`     | `number`    | `3600000`    | Registry cache TTL in ms                                    |
| `scanDepth`    | `"direct" \| "all"` | `"all"` | Direct dependencies only vs full tree                   |

---

## Risk Scoring Explained

### Maintainer changes

| Condition                                | Severity | Score |
| ---------------------------------------- | -------- | ----- |
| New maintainer added since baseline      | high     | 6     |

### Suspicious install scripts

| Pattern                                  | Points |
| ---------------------------------------- | ------ |
| `curl`/`wget` piped to a shell or node   | 5      |
| `base64` combined with `eval`/`exec`     | 5      |
| Dynamic `new Function(...)` call         | 3      |
| Reads `process.env.*`                    | 2      |
| Network call to a non-trusted domain     | 3      |
| Long opaque token (>= 200 base64 chars)  | 3      |
| One-liner > 300 chars without newlines   | 2      |

Total is capped at 10. Severity mapping: 8-10 = critical, 5-7 = high, 3-4 = medium, 1-2 = low.

### Version anomaly

| Condition                                          | Severity | Score |
| -------------------------------------------------- | -------- | ----- |
| Major version bump within 7 days of previous major | medium   | 4     |
| Package first published < 30 days ago              | low      | 2     |

### Typosquat

| Levenshtein distance to a top-200 pkg | Severity | Score |
| ------------------------------------- | -------- | ----- |
| 1–2                                   | critical | 10    |

---

## TypeScript Types

```ts
import { scan, audit, type ScanResult, type PackageRisk, type RiskLevel } from "chainsentry";

const result: ScanResult = await scan({ failOn: "high" });
for (const p of result.packages) {
  console.log(p.name, p.worstSeverity, p.totalScore);
}

const single: PackageRisk | undefined = await audit("react");
```

---

## CLI Reference

```
chainsentry scan [options]
  --fail-on <severity>    Exit 1 when worst severity ≥ this level (info|low|medium|high|critical)
  --format <fmt>          pretty | json (default pretty)
  --no-network            Skip registry lookups (uses cache only)
  --depth <depth>         direct | all (default all)

chainsentry baseline
  Save the current node_modules maintainer list as the trusted baseline.

chainsentry audit <package>
  Audit a single named package by fetching its registry metadata.
```

Sample JSON output:

```json
{
  "packages": [
    {
      "name": "reactt",
      "version": "0.0.1",
      "worstSeverity": "critical",
      "totalScore": 10,
      "findings": [
        { "rule": "typosquat", "severity": "critical", "message": "Name closely resembles \"react\" — likely typosquat", "score": 10 }
      ]
    }
  ],
  "scannedAt": "2026-01-12T10:01:22.000Z",
  "generatedAt": "2026-01-12T10:01:23.130Z",
  "totalPackages": 412
}
```

---

## Real-World Recipe — Full CI Security Gate

```bash
# 1. After a clean install, set the trusted baseline
npm ci
npx chainsentry baseline
```

```yaml
# 2. .github/workflows/security.yml — blocks PRs with new high-risk dependencies
name: security
on: [pull_request, schedule]
on:
  pull_request:
  schedule:
    - cron: "0 6 * * 1"  # Mondays 06:00 UTC

jobs:
  chainsentry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - id: scan
        run: npx chainsentry scan --fail-on high --format json > report.json || echo "had_findings=true" >> $GITHUB_OUTPUT
      - if: ${{ steps.scan.outputs.had_findings == 'true' }}
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data "$(jq -c '{text: "chainsentry found high-risk packages: " + (.packages | map(.name) | join(", "))}' report.json)" \
            "${{ secrets.SLACK_WEBHOOK_URL }}"
      - if: ${{ steps.scan.outputs.had_findings == 'true' }}
        run: exit 1
```

```json
// 3. .depguardrc.json — monorepo with a known noisy package
{
  "failOn": "high",
  "ignore": ["legacy-internal-tool"],
  "scanDepth": "all"
}
```

---

## False Positive Guide

The two most common false positives:

1. **`postinstall` runs `node-gyp` for native builds.** Already filtered; if you see it surface anyway, add the package to `ignore`.
2. **Major bump within 7 days.** Usually a frontend framework correcting a release. Add the specific package to `.depguardrc.json#ignore` once you've verified.

Workflow:

```bash
chainsentry audit suspicious-pkg   # confirm whether it's truly safe
# safe? add to ignore:
echo '{"ignore":["suspicious-pkg"]}' > .depguardrc.json
```

---

## Comparison Table

| Feature                       | npm audit | Socket.dev | **chainsentry** |
| ----------------------------- | :-------: | :--------: | :--------------: |
| Maintainer-change detection   |    ❌     |     ✅     |        ✅        |
| Install-script analysis       |    ❌     |     ✅     |        ✅        |
| Typosquat detection           |    ❌     |     ✅     |        ✅        |
| Free tier                     |    ✅     |   limited  |        ✅        |
| CI integration                |    ✅     |     ✅     |        ✅        |
| Offline mode                  |    ❌     |     ❌     |        ✅        |
| Self-hosted                   |    n/a    |     ❌     |        ✅        |

---

## License

MIT
