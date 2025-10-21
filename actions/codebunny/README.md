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
