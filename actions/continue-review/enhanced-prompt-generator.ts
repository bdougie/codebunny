import { ProjectContext } from './codebase-analyzer';

interface ReviewContext {
  pr: {
    number: number;
    title: string;
    body: string;
    author: string;
    files: PRFile[];
  };
  rules: Rule[];
  command?: string;
  repository: string;
}

interface PRFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
}

interface Rule {
  file: string;
  globs: string;
  description?: string;
  alwaysApply?: boolean;
  content: string;
}

/**
 * Generate enhanced, context-aware review prompt
 */
export function generateEnhancedPrompt(
  context: ReviewContext,
  projectContext: ProjectContext
): string {
  const { pr, rules, command, repository } = context;
  const { patterns, conventions, architecture } = projectContext;

  let prompt = `You are an expert code reviewer performing a thorough analysis of code changes.

# Repository: ${repository}

## Project Context

This is a **${inferProjectType(conventions, architecture)}** project.

${generateProjectContext(conventions, architecture, patterns, rules)}

---

# PR Analysis Task

## PR Details
- **Title**: ${pr.title}
- **Author**: ${pr.author}
- **Files Changed**: ${pr.files.length}
- **Description**: ${pr.body || 'No description provided'}

${command ? `\n## Specific Review Request\n"${command}"\n` : ''}

## Review Focus Areas

### 🎯 Critical Areas

1. **Correctness**: Does the code work as intended? Will it cause bugs or failures?
2. **Security**: Any exposed secrets, injection vulnerabilities, or unsafe operations?
3. **Performance**: Potential bottlenecks, memory leaks, or inefficient algorithms?
4. **Architecture**: Does this fit with the existing design? Any breaking changes?

### 🔍 Code Quality

1. **Readability**: Is the code clear and maintainable?
2. **Type Safety**: Proper typing (avoid 'any', use interfaces appropriately)
3. **Error Handling**: Are errors caught and handled properly?
4. **Testing**: Are tests included/updated for new functionality?

---

# Review Guidelines

## What to Focus On

✅ **Review carefully:**
- Bugs that will cause failures or incorrect behavior
- Security vulnerabilities or exposed credentials
- Breaking changes that affect other parts of the system
- Performance issues with measurable impact
- Missing error handling for edge cases
- Logic errors or incorrect assumptions
- Missing tests for new features or bug fixes

❌ **Avoid commenting on:**
- Style/formatting (handled by linters)
- Personal preferences or alternative implementations
- Minor naming choices unless genuinely confusing
- Already-working code that doesn't need changes

## Review Output Format

Structure your review with clear markdown formatting (use ## and ### headers, but never # h1):

**START WITH A TLDR RECOMMENDATION AT THE VERY TOP:**

## 🎯 TLDR
**Recommendation**: [MERGE ✅ | DON'T MERGE ❌ | MERGE AFTER CHANGES 🔄]
**Summary**: [One or two lines explaining the main reason for this recommendation]

---

Then continue with the detailed review:

## Review Summary

Provide a brief overview of your findings and overall assessment.

## Issues Found

For each issue, use ### headers with clear structure:

### 1. Issue Title
**Priority**: High/Medium/Low
**File**: \`path/to/file.ts:line\`
**Problem**: Clear description of the issue
**Why it matters**: Explanation of impact
**Fix**: Concrete solution with code example

## Recommendations
- Overall assessment and next steps
- Critical issues that need immediate attention
- Suggestions for improvement

---

# Code Changes to Review

`;

  // Add code changes with size limits
  let diffContent = '';
  let isTruncated = false;

  for (const file of pr.files) {
    if (file.patch) {
      diffContent += `\n## File: ${file.filename}\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;
    }
  }

  // Truncate if too large (15KB limit, increased from 12KB for better context)
  if (diffContent.length > 15000) {
    isTruncated = true;
    diffContent = diffContent.substring(0, 14000) + '\n```\n\n**⚠️ DIFF TRUNCATED**: The complete diff exceeds size limits. Review only the visible portions.';
  }

  prompt += diffContent;

  if (isTruncated) {
    prompt += `\n\n## ⚠️ Important: Handling Truncated Diffs\n\nThe diff has been truncated due to size. When reviewing:\n\n1. **DO NOT** comment on truncation or incomplete content\n2. **DO** review all visible code thoroughly\n3. **DO** mention if you need to see specific files to complete the review\n4. **DO** provide actionable feedback on what you can see\n5. Focus your review on the visible portions only\n\nIf critical files are cut off, recommend viewing them directly in the GitHub PR.`;
  }

  prompt += `
---

Please provide a comprehensive, actionable review that helps improve code quality while respecting the established patterns and conventions of this ${repository} codebase.

Focus on issues that matter for functionality, security, maintainability, and consistency with established patterns.

## Important Guidelines

- Only comment on what you can see in the diff
- Provide specific file paths and line numbers for all issues
- Be constructive and suggest solutions
- Focus on actual problems, not preferences

IMPORTANT FORMATTING RULES:
- Use proper markdown formatting with ## and ### headers for clear structure
- Never use # (h1 headers) - start with ## for main sections and ### for specific issues
- DO NOT mention or comment on diff truncation - review what you can see
- If the diff was truncated, simply review the visible portions without mentioning the truncation
- Include file paths and line numbers for all claims and suggestions`;

  return prompt;
}

/**
 * Generate project context section
 */
function generateProjectContext(
  conventions: any,
  architecture: any,
  patterns: any[],
  rules: Rule[]
): string {
  let context = '';

  // Add technology stack if available
  const { frameworks, libraries } = conventions.dependencies;
  if (frameworks.length > 0 || libraries.length > 0) {
    context += '### Technology Stack\n';
    if (frameworks.length > 0) {
      context += `- **Frameworks**: ${frameworks.join(', ')}\n`;
    }
    if (libraries.length > 0) {
      context += `- **Libraries**: ${libraries.slice(0, 5).join(', ')}\n`;
    }
    context += '\n';
  }

  // Add patterns if found
  const patternInsights = generatePatternInsights(patterns, conventions);
  if (patternInsights !== 'Standard patterns detected') {
    context += '### Codebase Patterns\n';
    context += patternInsights + '\n';
  }

  // Add custom rules if present
  if (rules.length > 0) {
    context += '### Project Rules\n';
    context += generateQualityStandards(rules) + '\n';
  }

  return context || 'Standard project structure detected.';
}

/**
 * Infer project type based on dependencies and patterns
 */
function inferProjectType(conventions: any, architecture: any): string {
  const { frameworks, libraries } = conventions.dependencies;

  if (frameworks.includes('React')) {
    if (frameworks.includes('Next.js')) return 'Next.js';
    return 'React';
  }

  if (frameworks.includes('Vue')) return 'Vue.js';
  if (frameworks.includes('Angular')) return 'Angular';
  if (frameworks.includes('Svelte')) return 'Svelte';
  if (libraries.includes('TypeScript')) return 'TypeScript';

  return 'JavaScript';
}

/**
 * Generate insights about established code patterns
 */
function generatePatternInsights(patterns: any[], conventions: any): string {
  let insights = '';

  // Naming conventions - most important for consistency
  const { naming } = conventions;
  const hasNamingInfo = naming.files.length > 0 || naming.functions.length > 0 || naming.types.length > 0;
  
  if (hasNamingInfo) {
    insights += '**Naming Conventions**: ';
    const conventions: string[] = [];
    
    if (naming.files.length > 0) {
      conventions.push(`files use ${getMostCommon(naming.files)}`);
    }
    if (naming.functions.length > 0) {
      conventions.push(`functions use ${getMostCommon(naming.functions)}`);
    }
    if (naming.types.length > 0) {
      conventions.push(`types use ${getMostCommon(naming.types)}`);
    }
    
    insights += conventions.join(', ') + '\n';
  }

  // Common imports - helps understand dependencies
  const topImports = patterns
    .filter((p) => p.type === 'import' && p.frequency > 1)
    .slice(0, 3)
    .map((p) => `\`${p.pattern}\``)
    .join(', ');

  if (topImports) {
    insights += `**Common Imports**: ${topImports}\n`;
  }

  return insights || 'Standard patterns detected';
}



/**
 * Generate quality standards from rules
 */
function generateQualityStandards(rules: Rule[]): string {
  if (rules.length === 0) {
    return '';
  }

  const keyRules = rules
    .filter((rule) => rule.description)
    .slice(0, 5)
    .map((rule) => `- ${rule.description}`)
    .join('\n');

  return keyRules || 'Custom project rules apply';
}

/**
 * Get the most common item from an array
 */
function getMostCommon(arr: string[]): string {
  const counts = arr.reduce(
    (acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'mixed';
}
