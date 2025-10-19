# CodeBunny 🐰

A GitHub Action for AI-powered code reviews using Continue Agent.

## Overview

CodeBunny is a powerful GitHub Action that provides intelligent, context-aware code reviews on your pull requests using Continue's AI capabilities. It understands your codebase patterns, applies custom rules, and provides actionable feedback.

## Features

✅ **Automated AI Reviews** - Reviews are triggered automatically on PR creation and updates  
✅ **Codebase Pattern Analysis** - Understands your project's conventions and architecture  
✅ **Custom Rules** - Define project-specific review guidelines  
✅ **Interactive Commands** - Trigger focused reviews with `@continue-agent` mentions  
✅ **Sticky Progress Comments** - Single updating comment instead of spam  
✅ **Security-First** - GitHub App authentication for secure access  

## Quick Start

### 1. Set Up GitHub App

Create a GitHub App with these permissions:
- **Contents**: Read
- **Issues**: Write  
- **Pull Requests**: Write

[Detailed App Setup Guide](actions/codebunny/README.md#prerequisites)

### 2. Configure Secrets

Add these to your repository settings:

**Variables:**
```
CONTINUE_APP_ID=your-app-id
CONTINUE_ORG=your-continue-org
CONTINUE_CONFIG=your-org/assistant-name
```

**Secrets:**
```
CONTINUE_APP_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
CONTINUE_API_KEY=your-continue-api-key
```

### 3. Use in Your Repo

#### Option A: Use as a GitHub Action (Recommended)

Reference this repo in your workflow:

```yaml
# .github/workflows/code-review.yml
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

#### Option B: Copy Action to Your Repo

1. Copy the `actions/codebunny` folder to your repository
2. Reference it locally: `uses: ./actions/codebunny`

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

## Acknowledgments

- Built with [Continue](https://continue.dev)
- Inspired by the need for smarter code reviews
- Thanks to the open source community

---

Made with ❤️ by [@bdougie](https://github.com/bdougie)
