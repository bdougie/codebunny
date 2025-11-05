![CodeBunny Banner](.github/codebunny-banner.png)

# CodeBunny 🐰

A GitHub Action for AI-powered code reviews using Continue Agent.

## Overview

CodeBunny is a GitHub Action that provides intelligent, context-aware code reviews on your pull requests using [Continue's AI capabilities](https://continue.dev). It analyzes your codebase patterns, applies custom rules, and provides actionable feedback.

### Why CodeBunny?

**Own Your Review Data** - Unlike SaaS code review services, CodeBunny runs entirely in your GitHub Actions environment. Your code never leaves your repository, and all review data stays under your control.

**Powered by Continue** - Built on [Continue](https://www.continue.dev/), the leading open-source AI code assistant. Use Continue's Hub service or [bring your own key (BYOK)](https://docs.continue.dev/guides/understanding-configs) for complete control.

**Battle-Tested** - Inspired by existing code review tools and refined in the [contributor.info](https://github.com/bdougie/contributor.info) repository. Now generalized for any JavaScript/TypeScript project.

## Features

✅ **Automated AI Reviews** - Reviews are triggered automatically on PR creation and updates  
✅ **Codebase Pattern Analysis** - Understands your project's conventions and architecture  
✅ **Custom Rules** - Define project-specific review guidelines  
✅ **Interactive Commands** - Trigger focused reviews with `@codebunny` mentions  
✅ **Review History Tracking** - Persistent review summaries in `.contributor/reviews/`  
✅ **Approval State Monitoring** - Track how often PRs go in/out of approval  
✅ **Sticky Comments** - Updates existing review comments within 1 hour to reduce PR noise  
✅ **Optional Prisma Storage** - Unlimited review history with Postgres backend  
✅ **Privacy-First** - Runs in your GitHub Actions, your code never leaves your repo  
✅ **Bring Your Own Key** - Use Continue's Hub or [BYOK](https://docs.continue.dev/guides/understanding-configs) for full control

## Installation

### Versioning

CodeBunny follows [Semantic Versioning](https://semver.org/). We recommend pinning to a specific major version for stability:

```yaml
# Recommended: Pin to major version (gets latest features and fixes)
- uses: bdougie/codebunny@v1

# Pin to specific version (maximum stability)
- uses: bdougie/codebunny@v1.0.0

# Always latest (not recommended for production)
- uses: bdougie/codebunny@main
```

**Version Types:**
- **Major (v1, v2)** - May include breaking changes
- **Minor (v1.1, v1.2)** - New features, backward compatible
- **Patch (v1.0.1, v1.0.2)** - Bug fixes only

See [CHANGELOG.md](CHANGELOG.md) for release history.

### Prerequisites

- A GitHub repository with pull requests
- Node.js 20+ (automatically available in GitHub Actions)
- A [Continue account](https://hub.continue.dev) (or [BYOK setup](https://docs.continue.dev/guides/understanding-configs))
- A Continue Assistant configured for code reviews

### Step 1: Create a GitHub App

Create a GitHub App with these permissions:
- **Contents**: Read
- **Issues**: Write  
- **Pull Requests**: Write

**Need help?** See the [Detailed GitHub App Setup Guide](actions/codebunny/README.md#prerequisites)

### Step 2: Configure Repository Secrets

Add these to your repository settings (Settings → Secrets and variables → Actions):

#### Variables (Required)
- `CONTINUE_ORG` - Your Continue Hub organization name
- `CONTINUE_CONFIG` - Your Continue assistant path (format: `username/assistant-name`)

#### Secrets (Required)
- `CONTINUE_API_KEY` - Your Continue API key from [hub.continue.dev](https://hub.continue.dev) (or your BYOK provider)

#### Optional: GitHub App (Recommended for enhanced permissions)

For better API rate limits and permissions, you can optionally set up a GitHub App:

**Variables:**
- `APP_ID` - Your GitHub App ID (found in app settings)

**Secrets:**
- `APP_PRIVATE_KEY` - The private key file content

**Without GitHub App:** The action will use the default `GITHUB_TOKEN` with standard permissions.

### Step 3: Add Workflow to Your Repository

Create `.github/workflows/code-review.yml` in your repository:

#### Option A: Simple Setup (No GitHub App)

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@codebunny'))
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: CodeBunny Review
        uses: bdougie/codebunny@v1
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: ${{ vars.CONTINUE_ORG }}
          continue-config: ${{ vars.CONTINUE_CONFIG }}
```

#### Option B: With GitHub App (Enhanced Permissions)

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@codebunny'))
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Optional: Generate GitHub App token
      - name: Generate App Token
        id: app-token
        if: vars.APP_ID != ''
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: CodeBunny Review
        uses: bdougie/codebunny@v1
        with:
          github-token: ${{ steps.app-token.outputs.token || github.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: ${{ vars.CONTINUE_ORG }}
          continue-config: ${{ vars.CONTINUE_CONFIG }}
```

### Step 4: Test It Out

1. **Create a test PR** or push changes to an existing one
2. **Watch for the CodeBunny comment** - It will appear automatically
3. **Try interactive commands** - Comment `@codebunny review this` on any PR

## Alternative: Self-Hosted Installation

If you prefer to host the action in your own repository:

1. Copy the `actions/codebunny` folder to your repository
2. Update the workflow to use the local path:
   ```yaml
   - name: CodeBunny Review
     uses: ./actions/codebunny
   ```

## Custom Rules

Create review rules in `.continue/rules/` to enforce project-specific standards:

```markdown
---
globs: "**/*.{ts,tsx}"
description: "TypeScript Standards"
---

# TypeScript Best Practices

- Use strict type checking
- Avoid 'any' types
- Prefer interfaces for object shapes
- Use proper error handling
```

### Example Rules

**Security Rule** (`.continue/rules/security.md`):
```markdown
---
globs: "**/*.{ts,js,tsx,jsx}"
description: "Security Review"
alwaysApply: true
---

# Security Checklist

- No hardcoded credentials or API keys
- Validate and sanitize user inputs
- Use parameterized queries
- Check for XSS vulnerabilities
- Verify authentication/authorization
```

**Testing Rule** (`.continue/rules/testing.md`):
```markdown
---
globs: "**/*.{test,spec}.{ts,tsx,js,jsx}"
description: "Testing Standards"
---

# Testing Guidelines

- Write tests for new features
- Test edge cases and error conditions
- Use descriptive test names
- Keep tests focused and isolated
```

## Interactive Commands

Comment on any PR to trigger focused reviews:

```
@codebunny check for security issues
@codebunny review the TypeScript types
@codebunny explain the architecture changes
@codebunny suggest performance improvements
```

## Sticky Comments

CodeBunny implements "sticky comments" to keep your PR threads clean and organized:

- **Within 1 hour**: New reviews update the existing comment
- **After 1 hour**: Creates a fresh comment for the new review
- **Benefits**: Reduces notification noise and keeps PR threads readable

**How it works:**

1. First review creates a new comment
2. Subsequent reviews within 1 hour update the same comment
3. After 1 hour, a new comment is created (useful for tracking review iterations)

**Example timeline:**
- `00:00` - Initial review posted (Comment #1)
- `00:30` - Code updated, review updates Comment #1
- `00:45` - Another update, still updates Comment #1
- `01:15` - After 1 hour, creates Comment #2 (new review iteration)

This approach balances keeping threads clean while preserving the history of significant review iterations.

## How It Works

```
┌─────────────────┐
│   PR Created    │
│   or Updated    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Load Custom    │
│     Rules       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Analyze        │
│  Codebase       │
│  Patterns       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate       │
│  Enhanced       │
│  Prompt         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Continue CLI   │
│  Review         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post/Update    │
│  Comment        │
└─────────────────┘
```

## Project Structure

```
codebunny/
├── actions/
│   └── codebunny/              # Main action implementation
│       ├── action.yml          # Action definition
│       ├── index.ts            # Main entry point
│       ├── codebase-analyzer.ts
│       ├── enhanced-prompt-generator.ts
│       ├── review-metrics.ts
│       ├── review-history.ts   # Historical review tracking
│       ├── github-app-auth.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── .contributor/
│   └── reviews/                # Historical review summaries
│       └── pr-*.md             # Per-PR review history
├── .github/
│   └── workflows/
│       └── codebunny.yml       # Example workflow
└── README.md
```

## Advanced Configuration

### Environment Variables

- `DEBUG_MODE=true` - Enable verbose logging
- `CONTINUE_API_KEY` - Your Continue API key
- `GITHUB_TOKEN` - GitHub App installation token

### Review History Tracking

CodeBunny maintains a historical record of all reviews for continuous learning:

**Review Summaries** (`.contributor/reviews/pr-{number}.md`):
- Chronological log of all reviews for each PR
- Approval state transitions (MERGE ✅ → CHANGES 🔄 → MERGE ✅)
- @codebunny mention timestamps and responses
- Key metrics: processing time, issues found, patterns detected
- Expandable sections with full review details

**Review Metrics** (`.continue/review-metrics.json`):
- Processing time trends
- Issues found by priority
- Rules applied per review
- Patterns detected across reviews

**How It Works:**
1. Each review is saved as a GitHub Actions artifact
2. On subsequent reviews, previous artifacts are downloaded
3. Review history is aggregated into markdown files
4. Approval state changes are tracked and counted
5. @codebunny mentions are logged with timestamps

View your review summaries in `.contributor/reviews/` to see how your PRs evolved!

### Prisma Postgres Storage (Optional)

By default, CodeBunny stores review metrics in a local file (`.continue/review-metrics.json`) with a 100-review limit. For unlimited history and advanced analytics, you can optionally enable Prisma Postgres storage.

#### Benefits

- **Unlimited Review History** - No 100-review cap
- **Team Analytics** - Track code quality trends across your organization
- **Approval Tracking** - Monitor approval state transitions over time
- **Cross-PR Analysis** - Identify patterns across all pull requests
- **Serverless-Optimized** - Built-in connection pooling for GitHub Actions

#### Setup Instructions

Prisma storage requires a PostgreSQL database. Choose one of these options:

##### Option A: Quick Setup with Neon (Recommended)

[Neon](https://neon.tech) provides a free serverless Postgres database, perfect for CodeBunny:

1. **Create a Neon account** at [neon.tech](https://neon.tech)
2. **Create a new project** - This automatically creates a database
3. **Get your connection strings** from the Neon dashboard:
   - **Connection pooling URL** (for DATABASE_URL) - Uses port 5432 with connection pooling
   - **Direct connection URL** (for DIRECT_DATABASE_URL) - Direct connection without pooling
4. **Run database migrations** locally to set up the schema:
   ```bash
   cd actions/codebunny
   npm install
   
   # Set your connection strings
   export DATABASE_URL="postgresql://user:pass@host.neon.tech:5432/db?sslmode=require"
   export DIRECT_DATABASE_URL="postgresql://user:pass@host.neon.tech:5432/db?sslmode=require"
   
   # Run Prisma migrations
   npx prisma migrate deploy
   ```

##### Option B: Other PostgreSQL Providers

You can use any PostgreSQL database:

- **Supabase** - [supabase.com](https://supabase.com) (free tier available)
- **Railway** - [railway.app](https://railway.app) (simple deployment)
- **Heroku Postgres** - [heroku.com/postgres](https://www.heroku.com/postgres)
- **AWS RDS** - For production workloads
- **Self-hosted** - Your own PostgreSQL instance

**Setup steps:**
1. Create a PostgreSQL database with your chosen provider
2. Get both connection strings:
   - Pooled connection for `DATABASE_URL` (if available)
   - Direct connection for `DIRECT_DATABASE_URL`
3. Run migrations locally (see commands above)

**Connection String Format:**
```
postgresql://username:password@host:5432/database?sslmode=require
```

##### Option C: Prisma Platform (Coming Soon)

Prisma is developing a managed database platform with built-in tooling.

**Step 2: Configure Your Workflow**

Add Prisma storage inputs to your CodeBunny workflow:

```yaml
- name: CodeBunny Review
  uses: bdougie/codebunny/actions/codebunny@main
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: ${{ vars.CONTINUE_ORG }}
    continue-config: ${{ vars.CONTINUE_CONFIG }}
    # Enable Prisma storage
    enable-prisma-storage: 'true'
  env:
    # Provide database connection strings
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL }}
```

**Step 3: Add Repository Secrets**

Add to Settings → Secrets and variables → Actions:
- `DATABASE_URL` - Pooled connection string for serverless
- `DIRECT_DATABASE_URL` - Direct connection string for migrations

#### Storage Modes

**File Storage (Default)**:
- Stores in `.continue/review-metrics.json`
- 100-review limit
- Works immediately, no setup required
- Good for small teams and personal projects

**Prisma Storage (Opt-In)**:
- Unlimited review history
- Stores in Postgres database
- Requires database setup
- Advanced analytics capabilities
- Automatic approval transition tracking

#### Graceful Fallback

If Prisma storage is enabled but fails to connect:
- CodeBunny automatically falls back to file storage
- Review process continues without interruption
- Warning is logged for debugging

#### Example Analytics Queries

With Prisma storage enabled, you can query review data directly:

```sql
-- Get approval state transitions for a PR
SELECT * FROM "ApprovalTransition"
WHERE repository = 'owner/repo' AND "prNumber" = 123
ORDER BY timestamp ASC;

-- Team code quality trend (last 30 days)
SELECT "projectType", AVG("issuesHigh"), AVG("issuesMedium"), AVG("issuesLow")
FROM "ReviewSnapshot"
WHERE repository = 'owner/repo'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY "projectType";

-- Most common review states
SELECT "reviewState", COUNT(*)
FROM "ReviewSnapshot"
WHERE repository = 'owner/repo'
GROUP BY "reviewState"
ORDER BY COUNT(*) DESC;
```

## Troubleshooting

### "Continue CLI not found"
- The action installs the CLI automatically
- Check if `@continuedev/cli` is accessible
- Verify Node.js 20+ is available

### "Authentication failed"
- Verify your GitHub App ID and private key
- Ensure the App is installed on the repository
- Check App permissions match requirements

### "No review generated"
- Check Continue API key is valid
- Verify assistant configuration
- Look for errors in action logs

## Contributing

Contributions welcome! This project helps make code reviews more intelligent and context-aware.

### Development Setup

```bash
git clone https://github.com/bdougie/codebunny.git
cd codebunny/actions/codebunny
npm install
npm run build
```

### Testing Locally

Use [act](https://github.com/nektos/act) to test workflows locally:

```bash
act pull_request -e .github/events/pull_request.json
```

## License

MIT License - See LICENSE file for details

## Why Choose CodeBunny?

### Data Privacy & Control

**Your Code Stays in Your Repo** - CodeBunny runs as a GitHub Action in your own infrastructure. Unlike SaaS code review services, your code is never sent to third-party servers for analysis.

**Own Your Review History** - All review data is stored as GitHub comments and optional metrics in your repository. You control the data, not a vendor.

**Bring Your Own Key Option** - Use [Continue's cloud service](https://hub.continue.dev) or [bring your own API keys](https://docs.continue.dev/guides/understanding-configs) for complete control over your AI infrastructure.

### Transparent & Open Source

**MIT Licensed** - Fork it, modify it, extend it. The code is yours.

**No Vendor Lock-In** - Switch between Continue's cloud and BYOK at any time. Your review configuration stays the same.

**Community-Driven** - Built on [Continue](https://www.continue.dev/), the open-source AI code assistant trusted by developers worldwide.

## Inspiration & History

CodeBunny was inspired by existing code review automation tools and the need for more context-aware, privacy-respecting AI reviews. It was initially developed and tested in the [contributor.info](https://github.com/bdougie/contributor.info) repository, where it helped maintain code quality across numerous contributions.

The action has been generalized to work with any JavaScript/TypeScript project, making it easy to add AI-powered code reviews to your workflow while maintaining control over your data.

## Acknowledgments

- Built with [Continue](https://www.continue.dev/) - The Continuous AI platform
- Tested and refined in [contributor.info](https://github.com/bdougie/contributor.info)
- Inspired by code review tools like Danger, CodeRabbit, and GitHub Copilot
- Thanks to the open source community

---

Made with ❤️ by [@bdougie](https://github.com/bdougie)
