# CodeBunny AI Review Action

A GitHub Action that performs AI-powered code reviews using Continue Agent on pull requests.

## Features

- 🤖 **Automated AI Code Reviews** - Intelligent code analysis on every PR
- 🧠 **Codebase Analysis** - Understands your project's patterns and conventions
- 📝 **Custom Rules Support** - Define project-specific review guidelines
- 💬 **Interactive Commands** - Trigger reviews with `@codebunny` comments
- 📊 **Clean Comments** - Single updating comment with progress
- ✅ **Universal** - Works with any JavaScript/TypeScript project
- 🔐 **Secure** - GitHub App authentication
- 🔑 **BYOK Support** - Use Continue's cloud or [bring your own keys](https://docs.continue.dev/guides/understanding-configs)

## Setup

### Prerequisites

1. **Continue Hub Account**
   - Sign up at [hub.continue.dev](https://hub.continue.dev)
   - Or use [BYOK with your own API keys](https://docs.continue.dev/guides/understanding-configs)

2. **Continue Assistant**
   - Create an assistant following the Continue documentation

3. **GitHub App (Optional)**
   - For enhanced permissions and rate limits, create a GitHub App with:
     - **Repository permissions:**
       - Contents: Read
       - Issues: Write
       - Pull requests: Write
   - Generate a private key and note the App ID

### GitHub Configuration

Store these as secrets/variables in your repository or organization:

**Required Variables:**
- `CONTINUE_ORG` - Your Continue Hub organization
- `CONTINUE_CONFIG` - Your assistant path (format: `username/assistant-name`)

**Required Secrets:**
- `CONTINUE_API_KEY` - Your Continue API key

**Optional (GitHub App):**
- `APP_ID` - Your GitHub App ID (Variable)
- `APP_PRIVATE_KEY` - Your GitHub App private key (Secret)

### Workflow Configuration

#### Simple Setup (No GitHub App)

```yaml
name: CodeBunny Review

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
        uses: bdougie/codebunny/actions/codebunny@main
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: ${{ vars.CONTINUE_ORG }}
          continue-config: ${{ vars.CONTINUE_CONFIG }}
```

#### With GitHub App (Enhanced)

```yaml
name: CodeBunny Review

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
        uses: bdougie/codebunny/actions/codebunny@main
        with:
          github-token: ${{ steps.app-token.outputs.token || github.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: ${{ vars.CONTINUE_ORG }}
          continue-config: ${{ vars.CONTINUE_CONFIG }}
```

## How It Works

1. **Triggers on**:
   - New PRs opened
   - PR updates (new commits)
   - Comments with `@codebunny`

2. **Analyzes codebase**:
   - Detects frameworks and libraries
   - Identifies naming conventions
   - Finds common patterns

3. **Loads custom rules** from `.continue/rules/*.md`

4. **Generates context-aware review** using Continue CLI

5. **Posts clean comment** that updates with progress

## Creating Rules

Create markdown files in `.continue/rules/` with YAML frontmatter:

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

Trigger specific reviews with PR comments:

```
@codebunny check for security issues
@codebunny review the TypeScript types
@codebunny suggest performance improvements
```

## Advanced Configuration

### Token Permission Scoping

You can limit the App token permissions:

```yaml
- name: Generate App Token
  id: app-token
  if: vars.APP_ID != ''
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    permissions: |
      contents: read
      pull-requests: write
      issues: write
```

### Multiple Repository Support

For organizations with many repositories:

```yaml
- name: Generate App Token
  id: app-token
  if: vars.APP_ID != ''
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    repositories: |
      repo1
      repo2
      repo3
```

## Prisma Postgres Storage (Optional)

Enable persistent review history and analytics using Postgres via Prisma.

Workflow example:

```yaml
- name: CodeBunny Review (with Prisma Postgres)
  uses: bdougie/codebunny/actions/codebunny@main
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: ${{ vars.CONTINUE_ORG }}
    continue-config: ${{ vars.CONTINUE_CONFIG }}
    enable-prisma-storage: 'true'
    # Prisma Postgres connection strings
    database-url: ${{ secrets.PRISMA_DATABASE_URL }}          # e.g. prisma://xxxxxxxx
    direct-database-url: ${{ secrets.PRISMA_DIRECT_DATABASE_URL }} # e.g. postgresql://user:pass@host/db
```

⚠️ Note: The action automatically creates database tables on first run using `prisma db push`. Make sure the database exists and the connection string has CREATE TABLE permissions.

Where to get connection strings (Prisma Postgres):
- In Prisma Postgres, create or open your database
- Copy the Prisma connection URL (prisma://...) and store as secret PRISMA_DATABASE_URL
- Copy the Direct connection URL (postgresql://...) and store as secret PRISMA_DIRECT_DATABASE_URL
  - DIRECT is optional but recommended to ensure schema migrations succeed

Behavior and fallbacks:
- If enable-prisma-storage is 'true' and DATABASE_URL is provided, the action uses Prisma storage
- If Prisma setup fails or DATABASE_URL is missing, it gracefully falls back to file storage and continues

What Works Well
- ✅ Graceful fallback to file storage if Prisma fails
- ✅ Clear explanation of benefits
- ✅ Good example SQL queries for analytics
- ✅ Opt-in by default (won't break existing users)

Example analytics queries (run against your Postgres):
```sql
-- Top repositories by total reviews
SELECT repository, COUNT(*) AS total_reviews
FROM "ReviewSnapshot"
GROUP BY repository
ORDER BY total_reviews DESC
LIMIT 10;

-- Average issues found per review
SELECT AVG("issuesHigh" + "issuesMedium" + "issuesLow") AS avg_issues
FROM "ReviewSnapshot";

-- Approval states distribution
SELECT "reviewState", COUNT(*) AS count
FROM "ReviewSnapshot"
GROUP BY "reviewState"
ORDER BY count DESC;
```

Documentation status and next steps
- Summary: The core functionality works; docs have been updated to match the simplified implementation.
- Users were previously confused by:
  - Unused inputs
  - "Coming soon" features that were removed
  - Missing step-by-step guide for getting connection strings

Recommended next steps
1. Remove prisma-api-key and prisma-database-id from action.yml (done/not applicable)
2. Make DIRECT_DATABASE_URL optional for Prisma Postgres users (done)
3. Add detailed "Where to get connection strings" section with screenshots (added; screenshots optional)
4. Remove "Option B (coming soon)" or clarify it's not implemented (ensure any references are removed)

## Troubleshooting

### App Not Installed
- Verify the App is installed on the repository
- Check App installation settings in GitHub

### Authentication Failures
- Verify the App ID is correct
- Check the private key secret is properly formatted
- Ensure the private key hasn't expired

### Token Permission Issues
- Review the App's permission configuration
- Check if permissions are limited in the workflow
- Verify repository settings allow App access

## Implementation Details

This action is implemented in TypeScript for:
- Type safety and better error handling
- Integration with the main project's linting and build tools
- Easier maintenance and testing

The action uses:
- `@actions/core` and `@actions/github` for GitHub Actions integration
- Continue CLI via child process execution
- Sticky comments with HTML markers for clean PR threads

## License

Part of the codebunny project.
