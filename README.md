# CodeBunny 🐰

A GitHub Action for AI-powered code reviews using Continue Agent.

## Overview

CodeBunny is a GitHub Action that provides intelligent, context-aware code reviews on your pull requests using Continue's AI capabilities. It analyzes your codebase patterns, applies custom rules, and provides actionable feedback.

> **Note**: CodeBunny was inspired by existing code review applications and battle-tested in the [contributor.info](https://github.com/bdougie/contributor.info) repository. It's now generalized for use in any JavaScript/TypeScript project.

## Features

✅ **Automated AI Reviews** - Reviews are triggered automatically on PR creation and updates  
✅ **Codebase Pattern Analysis** - Understands your project's conventions and architecture  
✅ **Custom Rules** - Define project-specific review guidelines  
✅ **Interactive Commands** - Trigger focused reviews with `@continue-agent` mentions  
✅ **Sticky Progress Comments** - Single updating comment instead of spam  
✅ **Security-First** - GitHub App authentication for secure access  

## Installation

### Prerequisites

- A GitHub repository with pull requests
- Node.js 20+ (automatically available in GitHub Actions)
- A [Continue Hub](https://hub.continue.dev) account
- A Continue Assistant configured for code reviews

### Step 1: Create a GitHub App

Create a GitHub App with these permissions:
- **Contents**: Read
- **Issues**: Write  
- **Pull Requests**: Write

**Need help?** See the [Detailed GitHub App Setup Guide](actions/codebunny/README.md#prerequisites)

### Step 2: Install the GitHub App

1. Install your GitHub App on the repository (or organization)
2. Note the App ID from the app settings
3. Generate and download a private key

### Step 3: Configure Repository Secrets

In your repository settings, add these **Variables** and **Secrets**:

Add these to your repository settings:

#### Variables (Settings → Secrets and variables → Actions → Variables)
- `CONTINUE_APP_ID` - Your GitHub App ID (found in app settings)
- `CONTINUE_ORG` - Your Continue Hub organization name
- `CONTINUE_CONFIG` - Your Continue assistant path (format: `username/assistant-name`)

#### Secrets (Settings → Secrets and variables → Actions → Secrets)
- `CONTINUE_APP_PRIVATE_KEY` - The private key file content (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
- `CONTINUE_API_KEY` - Your Continue API key from [hub.continue.dev](https://hub.continue.dev)

### Step 4: Add Workflow to Your Repository

Create `.github/workflows/code-review.yml` in your repository:

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
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@continue-agent'))
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.CONTINUE_APP_ID }}
          private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}

      - name: CodeBunny Review
        uses: bdougie/codebunny/actions/codebunny@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: ${{ vars.CONTINUE_ORG }}
          continue-config: ${{ vars.CONTINUE_CONFIG }}
```

### Step 5: Test It Out

1. **Create a test PR** or push changes to an existing one
2. **Watch for the CodeBunny comment** - It will appear automatically
3. **Try interactive commands** - Comment `@continue-agent review this` on any PR

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
@continue-agent check for security issues
@continue-agent review the TypeScript types
@continue-agent explain the architecture changes
@continue-agent suggest performance improvements
```

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
│       ├── github-app-auth.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
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

### Metrics Tracking

The action tracks review metrics in `.continue/review-metrics.json`:
- Processing time
- Issues found by priority
- Rules applied
- Patterns detected

View metrics in your review comments.

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

## Inspiration & History

CodeBunny was inspired by existing code review automation tools and the need for more context-aware AI reviews. It was initially developed and tested in the [contributor.info](https://github.com/bdougie/contributor.info) repository, where it helped maintain code quality across numerous contributions.

The action has been generalized to work with any JavaScript/TypeScript project, making it easy to add AI-powered code reviews to your workflow.

## Acknowledgments

- Built with [Continue](https://continue.dev)
- Tested and refined in [contributor.info](https://github.com/bdougie/contributor.info)
- Inspired by code review tools like Danger, CodeRabbit, and GitHub Copilot
- Thanks to the open source community

---

Made with ❤️ by [@bdougie](https://github.com/bdougie)
