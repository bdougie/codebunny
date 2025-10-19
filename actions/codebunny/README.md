# CodeBunny AI Review Action

A GitHub Action that performs AI-powered code reviews using Continue Agent on pull requests.

## Features

- 🤖 **Automated AI Code Reviews** - Intelligent code analysis on every PR
- 🧠 **Codebase Analysis** - Understands your project's patterns and conventions
- 📝 **Custom Rules Support** - Define project-specific review guidelines
- 💬 **Interactive Commands** - Trigger reviews with `@continue-agent` comments
- 📊 **Clean Comments** - Single updating comment with progress
- ✅ **Universal** - Works with any JavaScript/TypeScript project
- 🔐 **Secure** - GitHub App authentication

## Setup

### Prerequisites

1. **GitHub App**
   - Create a GitHub App with these permissions:
     - **Repository permissions:**
       - Contents: Read
       - Issues: Write
       - Pull requests: Write
   - Generate a private key and note the App ID

2. **Continue Hub Account**
   - Sign up at [hub.continue.dev](https://hub.continue.dev)

3. **Continue Assistant**
   - Create an assistant following the Continue documentation

### GitHub Configuration

Store these as secrets/variables in your repository or organization:

**Variables:**
- `CONTINUE_APP_ID` - Your GitHub App ID

**Secrets:**
- `CONTINUE_APP_PRIVATE_KEY` - Your GitHub App private key
- `CONTINUE_API_KEY` - Your Continue API key

### Workflow Configuration

```yaml
name: Continue Review

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
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@continue-agent'))
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Generate GitHub App token for secure authentication
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.CONTINUE_APP_ID }}
          private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}

      # Run CodeBunny Review
      - name: CodeBunny Review
        uses: your-org/your-repo/actions/codebunny@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'your-org'
          continue-config: 'your-org/assistant-name'
```

## How It Works

1. **Triggers on**:
   - New PRs opened
   - PR updates (new commits)
   - Comments with `@continue-agent`

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
@continue-agent check for security issues
@continue-agent review the TypeScript types
@continue-agent suggest performance improvements
```

## Advanced Configuration

### Token Permission Scoping

You can limit the App token permissions:

```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.CONTINUE_APP_ID }}
    private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
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
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.CONTINUE_APP_ID }}
    private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
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
