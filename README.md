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
✅ **Sticky Progress Comments** - Single updating comment instead of spam  
✅ **Review History Tracking** - Persistent review summaries in `.contributor/reviews/`  
✅ **Approval State Monitoring** - Track how often PRs go in/out of approval  
✅ **Privacy-First** - Runs in your GitHub Actions, your code never leaves your repo  
✅ **Bring Your Own Key** - Use Continue's Hub or [BYOK](https://docs.continue.dev/guides/understanding-configs) for full control  

## Installation

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
        uses: bdougie/codebunny@main
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
        uses: bdougie/codebunny@main
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
