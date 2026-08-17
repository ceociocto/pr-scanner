# PR Scanner

A CLI tool that scans GitHub repositories for closed/merged Pull Requests, evaluates them against configurable quality standards, and outputs structured reports.

**Features:**
- 📊 13 rule-based evaluators (PR size, commit conventions, reviewer count, CI status, etc.)
- 🤖 3 AI semantic evaluators (description quality, code risk, review quality) — powered by configurable LLMs
- 📝 5 output formats: JSON, CSV, Markdown, Console (colored), AI Insight reports
- 💾 SQLite caching to avoid re-fetching data from the GitHub API
- 🔌 Plugin architecture — add new evaluators by implementing a single interface
- 🏢 GitHub.com + GitHub Enterprise Server support
- ⚙️ Fully configurable via YAML with environment variable interpolation

## Installation

```bash
npm install
npm run build
```

Or install globally:

```bash
npm link
pr-scanner --help
```

## Quick Start

### 1. Create a configuration file

```bash
pr-scanner config init
```

Or manually create `pr-scanner.config.yaml`:

```yaml
github:
  platform: github.com
  token: ${GITHUB_TOKEN}

repositories:
  - name: owner/repo

standards:
  prSize:
    enabled: true
    warning: 400
    ideal: 300
  # ... other standards use defaults
```

### 2. Run a scan

```bash
# Console output (default)
pr-scanner scan -c pr-scanner.config.yaml

# Markdown report to file
pr-scanner scan -c pr-scanner.config.yaml --format markdown -o report.md

# JSON for CI integration
pr-scanner scan -c pr-scanner.config.yaml --format json --output result.json

# With AI evaluation
pr-scanner scan -c pr-scanner.config.yaml --ai
```

### 3. Regenerate a report from cached data

```bash
pr-scanner report --scan-id <uuid> --format csv
```

## Configuration Reference

### Full example configuration

```yaml
# GitHub connection
github:
  platform: github.com                          # "github.com" or "github-enterprise"
  token: ${GITHUB_TOKEN}                          # Required; supports ${ENV_VAR}
  # baseUrl: https://github.my-company.com/api/v3  # Required for GHE
  # apiVersion: "3.16"

# Repositories to scan
repositories:
  - name: octocat/Hello-World
  - name: my-company/backend-api
    mergedAfter: 2025-01-01                       # Only scan PRs merged after this date
    mergedBefore: 2025-07-01
  - name: my-enterprise/internal-tools
    platform: github-enterprise                    # Override platform per repo
    token: ${GHE_TOKEN}                           # Override token per repo

# Scan behavior
scan:
  includeUnmerged: false                          # Include non-merged closed PRs
  maxPullRequests: 0                               # Max PRs per repo (0 = unlimited)
  concurrency: 5                                   # Parallel API requests

# Quality standards (13 rule evaluators)
standards:
  prSize:
    enabled: true
    warning: 400                                  # Lines changed warning threshold
    ideal: 300                                    # Lines changed ideal threshold
  commitConvention:
    enabled: true
    pattern: "^\\w+(\\(.+\\))?!?: .+"             # Commit message regex (default: Conventional Commits)
    allowedTypes: [feat, fix, refactor, docs, test, chore, perf, build, ci]
  reviewerCount:
    enabled: true
    minimum: 1                                    # Minimum approved reviewers
  ciStatus:
    enabled: true
    requireAllChecks: false                       # Require ALL checks (not just required ones)
  timeToMerge:
    enabled: true
    warningHours: 120                             # Warn if PR open >5 days
    criticalHours: 240                             # Fail if PR open >10 days
  timeToReview:
    enabled: true
    warningHours: 24                               # Warn if first review >24h
  labels:
    enabled: false                                # Disabled by default
    requiredLabels: [bug, enhancement]           # At least one required label
  branchNaming:
    enabled: true
    pattern: "^(feat|fix|refactor|docs|test|chore|perf)/.+"
  linkedIssues:
    enabled: true
    issuePattern: "(#\\d+|[A-Z]+-\\d+)"
  codeChurn:
    enabled: true
    maxFilesWarning: 20
  selfMerge:
    enabled: true
  revertRate:
    enabled: true
  reviewCommentCount:
    enabled: true
    warnZeroComments: true
    highCommentThreshold: 30

# Output settings
output:
  format: console                                 # json | csv | markdown | console
  detailLevel: detailed                            # summary | detailed | full
  # filePath: ./output/report.md                  # Write to file instead of stdout

# Cache settings
cache:
  dbPath: ./data/pr-scanner.db
  ttlHours: 24                                    # Cache TTL in hours

# AI configuration (Phase 6)
ai:
  enabled: false
  provider: anthropic                             # anthropic | openai | ollama
  model: claude-sonnet-4-20250514
  # apiKey: ${ANTHROPIC_API_KEY}
  maxTokensPerRequest: 4096
  maxTokensPerScan: 200000
  warnAtTokensPercent: 80
  concurrency: 3
  timeoutMs: 30000
  maxRetries: 3
```

### Environment variable interpolation

All string values support `${ENV_VAR}` syntax:

```yaml
github:
  token: ${GITHUB_TOKEN}

ai:
  apiKey: ${ANTHROPIC_API_KEY}
```

## CLI Commands

### `scan`

Scan repositories and evaluate PR quality.

```bash
pr-scanner scan -c <config> [options]
```

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to configuration file (required) |
| `--debug` | Enable debug output |
| `--no-ai` | Disable AI evaluation |
| `--format <format>` | Output format: `json`, `csv`, `markdown`, `console` |
| `-o, --output <path>` | Output file path |
| `--detail-level <level>` | Detail level: `summary`, `detailed`, `full` |
| `--force-ai` | Force re-evaluation with AI (ignore cache) |

### `config validate`

Validate a configuration file without scanning.

```bash
pr-scanner config validate -c <config>
```

### `config init`

Generate a starter configuration file.

```bash
pr-scanner config init -o pr-scanner.config.yaml
```

### `report`

Regenerate a report from cached scan data.

```bash
pr-scanner report --scan-id <uuid> --format <format>
```

## Evaluation Standards

### Rule Evaluators (13)

| # | Evaluator | What it checks | Default threshold |
|---|-----------|---------------|-------------------|
| 1 | PR Size | Total lines changed | Ideal ≤300, Warn ≤400 |
| 2 | Commit Convention | Conventional Commits format | feat/fix/refactor/docs/test/chore/perf/build/ci |
| 3 | Reviewer Count | Minimum approved reviewers | ≥1 |
| 4 | CI Status | All checks passed | All required checks pass |
| 5 | Time to Merge | Duration open → merged | Warn >120h, Fail >240h |
| 6 | Time to Review | Duration created → first review | Warn >24h |
| 7 | Labels | Required labels present | Disabled by default |
| 8 | Branch Naming | Branch name convention | feat/fix/refactor/docs/test/chore/perf/* |
| 9 | Linked Issues | PR body references issues | #123 or JIRA-456 pattern |
| 10 | Code Churn | Number of files changed | Warn >20 files |
| 11 | Self Merge | Author merged without approval | Not allowed |
| 12 | Revert Rate | Revert keyword detection | Any revert |
| 13 | Review Comments | Review comment count | Warn on 0 or >30 |

### AI Evaluators (3, Phase 6)

| # | Evaluator | What it checks |
|---|-----------|---------------|
| 14 | Description Quality (AI) | Does the PR description explain motivation, impact, and testing? |
| 15 | Code Risk (AI) | Does the diff introduce security, performance, or architectural risks? |
| 16 | Review Quality (AI) | Are reviews substantive or just "LGTM"? |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Configuration error |
| 2 | GitHub provider/authentication error |
| 3 | Database error |
| 4 | AI/LLM error |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Architecture

```
CLI Layer → Scanner Layer → Evaluator Layer → Reporter Layer
                │                  │               │
           Config Layer     GitHub Provider      Data Layer
                              (Strategy)        (SQLite)
```

- **Plugin evaluators**: Each evaluator implements the `Evaluator` interface. Add new standards by creating a new file and registering it.
- **Strategy pattern**: GitHub.com and GHE share the same `GitHubProvider` interface. The factory creates the correct implementation based on config.
- **Dual-layer evaluation**: Rule evaluators run first (fast, free), then AI evaluators (semantic, costs API tokens). Rule results are fed as context to AI evaluators.

## License

MIT
